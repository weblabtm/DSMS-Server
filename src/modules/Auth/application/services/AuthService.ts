/**
 * Application service that coordinates authentication and session issuance.
 * Controllers call this service so business rules stay out of HTTP handlers.
 */
import { AccessContext } from '../../domain/AccessContext.js';
import { type RoleName } from '../../domain/Role.js';
import { type AuthDao } from '../dao/AuthDao.js';
import { type AuthLoginRequestDto, type AuthLogoutRequestDto, type AuthRefreshRequestDto, type AuthRegisterRequestDto, type AuthSessionResponseDto } from '../dtos/AuthDtos.js';
import { PermissionGuard } from '../PermissionGuard.js';
import type { SessionRecord, CreateSessionInput, CreateSessionWithAccessJtiInput } from './SessionService.js';
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
    sessionService: {
        createSession(input: CreateSessionInput): Promise<SessionRecord>;
        createSessionWithAccessJti(input: CreateSessionWithAccessJtiInput): Promise<SessionRecord>;
        findByRefreshToken(refreshToken: string): Promise<SessionRecord | undefined>;
        rotateRefreshToken(refreshToken: string): Promise<SessionRecord>;
        revokeSession(sessionId: string): Promise<void>;
        updateAccessTokenJti?(sessionId: string, accessTokenJti: string): Promise<void>;
    };
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

        return this.toSessionResponse(await this.issueSession({
            userId: principal.userId,
            roles: principal.roles,
            tenantId: principal.tenantId,
            branchId: principal.branchId,
            tokenVersion: principal.tokenVersion,
        }));
    }

    public async issueSession(principal: {
        userId: string;
        roles: readonly RoleName[];
        tenantId?: string;
        branchId?: string;
        tokenVersion?: number;
    }): Promise<AuthSessionBundle> {
        const accessToken = this.dependencies.tokenService.issueAccessToken({
            subject: principal.userId,
            roles: principal.roles,
            tenantId: principal.tenantId,
            branchId: principal.branchId,
            tokenVersion: principal.tokenVersion,
        });

        const claims = this.dependencies.tokenService.verifyAccessToken(accessToken);

        const session = await this.dependencies.sessionService.createSessionWithAccessJti({
            userId: principal.userId,
            roles: principal.roles,
            tenantId: principal.tenantId,
            branchId: principal.branchId,
            tokenVersion: principal.tokenVersion,
            accessTokenJti: claims.jti,
        });

        return {
            sessionId: session.sessionId,
            refreshToken: session.refreshToken,
            accessToken,
            claims,
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
        return this.toSessionResponse(await this.refreshSession(request.refreshToken));
    }

    public async register(account: AuthRegisterRequestDto, inviterRole: RoleName): Promise<AuthSessionResponseDto> {
        const targetRole = account.role ?? 'Student';

        if (!this.canInviteRole(inviterRole, targetRole)) {
            throw new Error(`Role ${inviterRole} cannot create ${targetRole}`);
        }

        const principal = await this.dependencies.authDao.register(account);

        return this.toSessionResponse(await this.issueSession({
            userId: principal.userId,
            roles: principal.roles,
            tenantId: principal.tenantId,
            branchId: principal.branchId,
            tokenVersion: principal.tokenVersion,
        }));
    }

    public logout(request: AuthLogoutRequestDto): void {
        (async () => {
            const session = await (this.dependencies.sessionService as any).findByRefreshToken(request.refreshToken);

            if (!session) {
                return;
            }

            await (this.dependencies.sessionService as any).revokeSession(session.sessionId);
        })();
    }

    public async refreshSession(refreshToken: string): Promise<AuthSessionBundle> {
        const session: SessionRecord = await this.dependencies.sessionService.rotateRefreshToken(refreshToken as string);
        const accessToken = this.dependencies.tokenService.issueAccessToken({
            subject: session.userId,
            roles: session.roles,
            tenantId: session.tenantId,
            branchId: session.branchId,
            tokenVersion: session.tokenVersion,
        });

        const claims = this.dependencies.tokenService.verifyAccessToken(accessToken);

        // persist new access token jti if backed by DB
        if (typeof (this.dependencies.sessionService as any).updateAccessTokenJti === 'function') {
            // fire-and-forget: update jti if implementation supports it
            try {
                await (this.dependencies.sessionService as any).updateAccessTokenJti(session.sessionId, claims.jti);
            } catch (error) {
                // ignore jti persistence errors to avoid breaking refresh flow
            }
        }

        return {
            sessionId: session.sessionId,
            refreshToken: session.refreshToken,
            accessToken,
            claims,
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

    public canInviteRole(inviterRole: RoleName, targetRole: RoleName): boolean {
        switch (inviterRole) {
            case 'Super Admin':
                return targetRole === 'Tenant Admin';
            case 'Tenant Admin':
                return ['Branch Manager', 'Instructor', 'Front Desk', 'Student'].includes(targetRole);
            case 'Branch Manager':
                return ['Instructor', 'Front Desk', 'Student'].includes(targetRole);
            case 'Front Desk':
                return targetRole === 'Student';
            default:
                return false;
        }
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