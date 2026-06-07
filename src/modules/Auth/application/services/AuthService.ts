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
import type { BruteForceProtectionService } from './BruteForceProtectionService.js';
import type { ICaptchaValidator } from './ICaptchaValidator.js';
import { type IMfaTransactionStore } from './IMfaTransactionStore.js';
import crypto from 'crypto';

export type AuthSessionBundle = {
    sessionId: string;
    refreshToken: string;
    accessToken: string;
    claims: AccessTokenClaims;
    accessContext: AccessContext;
    rememberMe?: boolean;
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
    bruteForceService?: BruteForceProtectionService;
    captchaValidator?: ICaptchaValidator;
    emailService?: {
        queueEmail(to: string, subject: string, body: string, tenantId?: string, branchId?: string): Promise<any>;
    };
    mfaTransactionStore?: IMfaTransactionStore;
};

export class AuthService {
    private readonly permissionGuard: PermissionGuard;

    public constructor(private readonly dependencies: AuthServiceDependencies) {
        this.permissionGuard = dependencies.permissionGuard ?? new PermissionGuard();
    }

    public async login(credentials: AuthLoginRequestDto): Promise<AuthSessionResponseDto> {
        const { bruteForceService, captchaValidator, emailService } = this.dependencies;

        // 1. CAPTCHA validation
        if (captchaValidator) {
            const token = credentials.captchaToken || '';
            const isValidCaptcha = await captchaValidator.validate(token, credentials.ipAddress);
            if (!isValidCaptcha) {
                if (!token) {
                    throw new Error('CAPTCHA required');
                } else {
                    throw new Error('Invalid CAPTCHA token');
                }
            }
        }

        // 2. IP Rate limit check
        if (bruteForceService && credentials.ipAddress) {
            const isBlocked = await bruteForceService.isIpBlocked(credentials.ipAddress);
            if (isBlocked) {
                throw new Error('Too many login attempts. Please try again later.');
            }
        }

        // 3. Database Account lockout check
        const lockStatus = typeof this.dependencies.authDao.getUserLockStatus === 'function'
            ? await this.dependencies.authDao.getUserLockStatus(credentials.identifier)
            : null;

        if (lockStatus && lockStatus.isLocked) {
            if (lockStatus.unlockToken === null) {
                // Temporary lockout countdown validation and auto-unlock
                if (lockStatus.unlockTokenExpiresAt) {
                    const expiresAt = lockStatus.unlockTokenExpiresAt.getTime();
                    const now = Date.now();
                    if (now >= expiresAt) {
                        // Expired, automatically unlock
                        await this.dependencies.authDao.unlockAccountAutomatically(credentials.identifier);
                        if (bruteForceService) {
                            const ip = credentials.ipAddress || 'unknown';
                            await bruteForceService.registerSuccess(ip, credentials.identifier);
                        }
                    } else {
                        const diffMs = expiresAt - now;
                        const minutes = Math.floor(diffMs / 60000);
                        const seconds = Math.floor((diffMs % 60000) / 1000);
                        throw new Error(`Your account has been locked. Try again in ${minutes} minutes ${seconds} seconds.`);
                    }
                } else {
                    throw new Error('Your account has been locked.');
                }
            } else {
                throw new Error('Account is locked. Please check your email to unlock it.');
            }
        } else {
            // Fallback for compatibility
            const isLocked = await this.dependencies.authDao.isAccountLocked(credentials.identifier);
            if (isLocked) {
                throw new Error('Account is locked. Please check your email to unlock it.');
            }
        }

        // 4. Authenticate credentials
        const principal = await this.dependencies.authDao.authenticate(credentials);

        if (!principal) {
            // Register failed attempt
            if (bruteForceService) {
                const ip = credentials.ipAddress || 'unknown';
                const { accountLocked, accountFailures } = await bruteForceService.registerFailure(ip, credentials.identifier);

                if (accountLocked) {
                    const currentLockoutCount = lockStatus ? lockStatus.lockoutCount : 0;
                    if (currentLockoutCount === 0) {
                        // First Lockout (Temporary, 15 minutes)
                        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
                        if (typeof this.dependencies.authDao.lockAccountTemporarily === 'function') {
                            await this.dependencies.authDao.lockAccountTemporarily(credentials.identifier, expiresAt);
                            await this.dependencies.authDao.incrementLockoutCount(credentials.identifier);
                        }
                        throw new Error('Your account has been locked. Try again in 15 minutes 0 seconds.');
                    } else {
                        // Second Lockout (Permanent, generate unlock token)
                        const token = crypto.randomBytes(32).toString('hex');
                        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours expiration
                        if (typeof this.dependencies.authDao.lockAccountPermanently === 'function') {
                            await this.dependencies.authDao.lockAccountPermanently(credentials.identifier, token, expiresAt);
                            await this.dependencies.authDao.incrementLockoutCount(credentials.identifier);
                        } else {
                            // Fallback
                            await this.dependencies.authDao.lockAccount(credentials.identifier, token, expiresAt);
                        }

                        // Send unlock email
                        if (emailService) {
                            const baseUrl = process.env.SMS_CALLBACK_BASE_URL || 'http://localhost:3000';
                            const unlockLink = `${baseUrl}/auth/unlock?token=${token}`;
                            await emailService.queueEmail(
                                credentials.identifier,
                                'Account Locked',
                                `Your account has been locked due to too many failed login attempts. Click here to unlock it: ${unlockLink}`,
                                credentials.tenantId,
                                credentials.branchId
                            );
                        }

                        throw new Error('Account is locked. Please check your email to unlock it.');
                    }
                } else {
                    // Check warnings for 3 or fewer failed login attempts left (failures >= 2)
                    if (accountFailures >= 2) {
                        const attemptsLeft = 5 - accountFailures;
                        throw new Error(`Invalid credentials. ${attemptsLeft} ${attemptsLeft === 1 ? 'attempt' : 'attempts'} left.`);
                    }
                }
            }

            throw new Error('Invalid credentials');
        }

        // Check if user requires OTP (MFA)
        const user = await this.dependencies.authDao.findByIdentifier(credentials.identifier);
        if (user && user.phoneNumber) {
            const mfaStore = this.dependencies.mfaTransactionStore;
            if (!mfaStore) {
                throw new Error('MFA Transaction Store not configured');
            }

            if (credentials.mfaToken) {
                const isVerified = await mfaStore.isVerified(credentials.mfaToken);
                if (!isVerified) {
                    throw new Error('MFA verification required');
                }
                // Cleanup transaction
                await mfaStore.deleteTransaction(credentials.mfaToken);
            } else {
                // Generate a short-lived transaction token
                const mfaToken = await mfaStore.createTransaction(principal.userId, credentials.rememberMe);
                const otpError = new Error('OTP required');
                (otpError as any).mfaToken = mfaToken;
                (otpError as any).phoneNumber = user.phoneNumber;
                throw otpError;
            }
        }

        // 5. Success resets brute-force failure counters
        if (bruteForceService) {
            const ip = credentials.ipAddress || 'unknown';
            await bruteForceService.registerSuccess(ip, credentials.identifier);
            if (typeof this.dependencies.authDao.resetLockoutCount === 'function') {
                await this.dependencies.authDao.resetLockoutCount(credentials.identifier);
            }
        }

        return this.toSessionResponse(await this.issueSession({
            userId: principal.userId,
            roles: principal.roles,
            tenantId: principal.tenantId,
            branchId: principal.branchId,
            tokenVersion: principal.tokenVersion,
        }, credentials.rememberMe));
    }

    public async unlockAccount(token: string): Promise<boolean> {
        const user = typeof this.dependencies.authDao.getUserByUnlockToken === 'function'
            ? await this.dependencies.authDao.getUserByUnlockToken(token)
            : null;

        const unlocked = await this.dependencies.authDao.unlockAccountByToken(token);
        if (unlocked && user) {
            if (typeof this.dependencies.authDao.resetLockoutCount === 'function') {
                await this.dependencies.authDao.resetLockoutCount(user.identifier);
            }
        }
        return unlocked;
    }

    public async issueSession(
        principal: {
            userId: string;
            roles: readonly RoleName[];
            tenantId?: string;
            branchId?: string;
            tokenVersion?: number;
        },
        rememberMe?: boolean
    ): Promise<AuthSessionBundle> {
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
            rememberMe,
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
            rememberMe: session.rememberMe,
        };
    }

    public async refresh(request: AuthRefreshRequestDto): Promise<AuthSessionResponseDto> {
        return this.toSessionResponse(await this.refreshSession(request.refreshToken));
    }

    public async register(account: AuthRegisterRequestDto, inviterRole?: RoleName): Promise<AuthSessionResponseDto> {
        const targetRole = account.role ?? 'Student';

        if (!inviterRole) {
            if (targetRole !== 'Tenant Admin') {
                throw new Error('Only Tenant Admin can self-register');
            }
            // Explicitly clear tenantId for self-registering Tenant Admins (pending tenant creation)
            account.tenantId = undefined;
        } else if (!this.canInviteRole(inviterRole, targetRole)) {
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

    public async logout(request: AuthLogoutRequestDto): Promise<void> {
        const session = await (this.dependencies.sessionService as any).findByRefreshToken(request.refreshToken);

        if (!session) {
            return;
        }

        await (this.dependencies.sessionService as any).revokeSession(session.sessionId);
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
            rememberMe: session.rememberMe,
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
            ...(bundle.rememberMe !== undefined ? { rememberMe: bundle.rememberMe } : {}),
        };
    }
}