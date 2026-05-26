/**
 * Application service that coordinates authentication and session issuance.
 * Controllers call this service so business rules stay out of HTTP handlers.
 */
import { AccessContext } from '../../domain/AccessContext.js';
import { type RoleName } from '../../domain/Role.js';
import { type AuthDao } from '../dao/AuthDao.js';
import { type AuthLoginRequestDto, type AuthRefreshRequestDto, type AuthSessionResponseDto } from '../dtos/AuthDtos.js';
import { PermissionGuard } from '../PermissionGuard.js';
import { SessionService, type SessionRecord } from './SessionService.js';
import { TokenService, type AccessTokenClaims } from './TokenService.js';

export type AuthSessionBundle = {
    sessionId: string;
    refreshToken: string;
    accessToken: string;
    claims: AccessTokenClaims;
    accessContext: AccessContext;
};

export type AuthServiceDependencies = {
    tokenService: TokenService;
    sessionService: SessionService;
    authDao: AuthDao;
    permissionGuard?: PermissionGuard;
};

export class AuthService {
    private readonly permissionGuard: PermissionGuard;

    public constructor(private readonly dependencies: AuthServiceDependencies) {
        this.permissionGuard = dependencies.permissionGuard ?? new PermissionGuard();
    }

    public async login(credentials: AuthLoginRequestDto): Promise<AuthSessionResponseDto> {
        const principal = await this.dependencies.authDao.authenticate(credentials);

        if (!principal) {
            throw new Error('Invalid credentials');
        }

        return this.toSessionResponse(this.issueSession({
            userId: principal.userId,
            roles: principal.roles,
            tenantId: principal.tenantId,
            branchId: principal.branchId,
            tokenVersion: principal.tokenVersion,
        }));
    }

    public issueSession(principal: {
        userId: string;
        roles: readonly RoleName[];
        tenantId?: string;
        branchId?: string;
        tokenVersion?: number;
    }): AuthSessionBundle {
        const session = this.dependencies.sessionService.createSession({
            userId: principal.userId,
            roles: principal.roles,
            tenantId: principal.tenantId,
            branchId: principal.branchId,
            tokenVersion: principal.tokenVersion,
        });

        const accessToken = this.dependencies.tokenService.issueAccessToken({
            subject: principal.userId,
            roles: principal.roles,
            tenantId: principal.tenantId,
            branchId: principal.branchId,
            tokenVersion: session.tokenVersion,
        });

        return {
            sessionId: session.sessionId,
            refreshToken: session.refreshToken,
            accessToken,
            claims: this.dependencies.tokenService.verifyAccessToken(accessToken),
            accessContext: new AccessContext({
                userId: principal.userId,
                roles: principal.roles,
                tenantId: principal.tenantId,
                branchId: principal.branchId,
                tokenVersion: session.tokenVersion,
            }),
        };
    }

    public async refresh(request: AuthRefreshRequestDto): Promise<AuthSessionResponseDto> {
        return this.toSessionResponse(this.refreshSession(request.refreshToken));
    }

    public refreshSession(refreshToken: string): AuthSessionBundle {
        const session: SessionRecord = this.dependencies.sessionService.rotateRefreshToken(refreshToken);
        const accessToken = this.dependencies.tokenService.issueAccessToken({
            subject: session.userId,
            roles: session.roles,
            tenantId: session.tenantId,
            branchId: session.branchId,
            tokenVersion: session.tokenVersion,
        });

        return {
            sessionId: session.sessionId,
            refreshToken: session.refreshToken,
            accessToken,
            claims: this.dependencies.tokenService.verifyAccessToken(accessToken),
            accessContext: new AccessContext({
                userId: session.userId,
                roles: session.roles,
                tenantId: session.tenantId,
                branchId: session.branchId,
                tokenVersion: session.tokenVersion,
            }),
        };
    }

    public assertPermission(roleName: RoleName, permissionKey: string): void {
        this.permissionGuard.assertCan(roleName, permissionKey);
    }

    private toSessionResponse(bundle: AuthSessionBundle): AuthSessionResponseDto {
        return {
            sessionId: bundle.sessionId,
            refreshToken: bundle.refreshToken,
            accessToken: bundle.accessToken,
            userId: bundle.accessContext.userId,
            roles: bundle.accessContext.roles,
            ...(bundle.accessContext.tenantId ? { tenantId: bundle.accessContext.tenantId } : {}),
            ...(bundle.accessContext.branchId ? { branchId: bundle.accessContext.branchId } : {}),
        };
    }
}