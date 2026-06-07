/**
 * HTTP controller for authentication endpoints.
 * It only translates requests to DTOs and returns the service response as JSON.
 */
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { type RedisClientType } from 'redis';

import { AuthService } from '../../application/services/AuthService.js';
import { OtpService } from '../../application/services/OtpService.js';
import { type IMfaTransactionStore } from '../../application/services/IMfaTransactionStore.js';
import { type ICaptchaValidator } from '../../application/services/ICaptchaValidator.js';
import { CaptchaService } from '../../application/services/CaptchaService.js';
import { AuthRequestMapper } from '../mappers/AuthRequestMapper.js';
import { AuthResponseMapper } from '../mappers/AuthResponseMapper.js';
import { resolveTenantSlug } from '../../../../shared/utils/tenantResolver.js';

export class AuthController {
    private readonly loginStateMemoryStore = new Map<string, { userId: string; identifier: string; rememberMe?: boolean; roles: readonly string[]; tenantId?: string; branchId?: string; tokenVersion?: number; captchaVerified?: boolean; deviceFingerprint?: string; deviceOs?: string; devicePlatform?: string; expiresAt: Date }>();

    public constructor(
        private readonly authService: AuthService,
        private readonly otpService: OtpService,
        private readonly captchaValidator: ICaptchaValidator,
        private readonly mfaTransactionStore: IMfaTransactionStore,
        private readonly captchaService?: CaptchaService,
        private readonly redisClient: RedisClientType | null = null
    ) { }

    private async saveLoginState(token: string, data: any): Promise<void> {
        if (this.redisClient && this.redisClient.isOpen) {
            await this.redisClient.setEx(`login:state:${token}`, 300, JSON.stringify(data));
        } else {
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
            this.loginStateMemoryStore.set(token, { ...data, expiresAt });
        }
    }

    private async getLoginState(token: string): Promise<any | null> {
        if (this.redisClient && this.redisClient.isOpen) {
            const data = await this.redisClient.get(`login:state:${token}`);
            if (!data) return null;
            return JSON.parse(data);
        } else {
            const entry = this.loginStateMemoryStore.get(token);
            if (!entry || new Date() > entry.expiresAt) {
                if (entry) this.loginStateMemoryStore.delete(token);
                return null;
            }
            return entry;
        }
    }

    private async deleteLoginState(token: string): Promise<void> {
        if (this.redisClient && this.redisClient.isOpen) {
            await this.redisClient.del(`login:state:${token}`);
        } else {
            this.loginStateMemoryStore.delete(token);
        }
    }

    private setRefreshTokenCookie(response: Response, session: { refreshToken: string; rememberMe?: boolean }): void {
        if (typeof response.cookie !== 'function') {
            return;
        }
        const isProd = process.env.NODE_ENV === 'production';
        const maxAge = session.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
        
        response.cookie('refresh_token', session.refreshToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: 'lax',
            maxAge,
            path: '/auth'
        });
    }

    public async login(request: Request, response: Response): Promise<void> {
        try {
            const dto = AuthRequestMapper.toLoginRequestDto(request.body);
            dto.ipAddress = request.ip || request.socket?.remoteAddress;
            
            const hostTenantSlug = resolveTenantSlug(request.headers);
            if (hostTenantSlug) {
                dto.tenantId = hostTenantSlug;
            }

            // 1. Authenticate user's credentials
            const principal = await this.authService.authenticateCredentials(dto);

            // 2. Check if captcha was already verified via cookie (Login page re-submission after /challenge)
            let captchaAlreadyVerified = false;
            if (this.captchaService) {
                let captchaVerifiedToken = (request as any).cookies?.captcha_verified_token as string | undefined;
                if (!captchaVerifiedToken) {
                    const cookieHeader = request.headers.cookie;
                    if (cookieHeader) {
                        const cookies = cookieHeader.split(';').reduce((acc, c) => {
                            const [name, val] = c.split('=').map(x => x.trim());
                            if (name) acc[name] = val;
                            return acc;
                        }, {} as Record<string, string>);
                        captchaVerifiedToken = cookies['captcha_verified_token'];
                    }
                }
                if (captchaVerifiedToken) {
                    captchaAlreadyVerified = await this.captchaService.consumeToken(captchaVerifiedToken);
                    if (captchaAlreadyVerified) {
                        response.clearCookie('captcha_verified_token');
                    }
                }
            }

            // 3. Determine next verification steps
            let needsCaptcha = false;
            if (!captchaAlreadyVerified && this.captchaValidator) {
                const isBypassed = await this.captchaValidator.validate('', dto.ipAddress);
                needsCaptcha = !isBypassed;
            }

            // 4. Generate short-lived master login state token
            const loginStateToken = crypto.randomUUID();
            const loginStateData = {
                userId: principal.userId,
                identifier: principal.identifier,
                rememberMe: dto.rememberMe,
                roles: principal.roles,
                tenantId: principal.tenantId,
                branchId: principal.branchId,
                tokenVersion: principal.tokenVersion,
                captchaVerified: !needsCaptcha,
                deviceFingerprint: dto.deviceFingerprint,
                deviceOs: dto.deviceOs,
                devicePlatform: dto.devicePlatform
            };
            await this.saveLoginState(loginStateToken, loginStateData);

            // Set cookie: HttpOnly, secure in prod, maxAge = 5 minutes
            const isProd = process.env.NODE_ENV === 'production';
            response.cookie('login_state_token', loginStateToken, {
                httpOnly: true,
                secure: isProd,
                sameSite: 'lax',
                maxAge: 5 * 60 * 1000
            });

            if (needsCaptcha) {
                response.status(401).json({ message: 'CAPTCHA required' });
                return;
            }

            // Check if OTP is required
            const user = await this.authService.dependencies.authDao.findByIdentifier(dto.identifier);
            if (user && user.phoneNumber) {
                response.status(401).json({
                    message: 'OTP required',
                    phoneNumber: user.phoneNumber,
                    email: dto.identifier
                });
                return;
            }


            // If neither is required, finalize session immediately
            const session = await this.authService.issueSession({
                userId: principal.userId,
                roles: principal.roles,
                tenantId: principal.tenantId,
                branchId: principal.branchId,
                tokenVersion: principal.tokenVersion,
                deviceFingerprint: dto.deviceFingerprint,
                deviceOs: dto.deviceOs,
                devicePlatform: dto.devicePlatform,
            }, dto.rememberMe);

            // Clean up temporary login state
            await this.deleteLoginState(loginStateToken);
            response.clearCookie('login_state_token');

            this.setRefreshTokenCookie(response, session);
            response.status(200).json(AuthResponseMapper.toLoginResponseDto({
                sessionId: session.sessionId,
                refreshToken: session.refreshToken,
                accessToken: session.accessToken,
                userId: session.accessContext.userId,
                roles: session.accessContext.roles,
                tenantId: session.accessContext.tenantId,
                branchId: session.accessContext.branchId,
                rememberMe: session.rememberMe,
            }));

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            let status = 400;
            if (message.includes('Invalid credentials')) {
                status = 401;
            } else if (message.includes('Too many login attempts')) {
                status = 429;
            } else if (message.includes('locked')) {
                status = 403;
            }
            response.status(status).json({ message });
        }
    }

    // GET /auth/unlock
    public async unlock(request: Request, response: Response): Promise<void> {
        const token = String(request.query.token || '');
        if (!token) {
            response.status(400).json({ message: 'Unlock token is required.' });
            return;
        }

        const frontendUrl = process.env.CLIENT_BASE_URL || 'http://localhost:5173';
        try {
            const user = typeof this.authService.dependencies.authDao.getUserByUnlockToken === 'function'
                ? await this.authService.dependencies.authDao.getUserByUnlockToken(token)
                : null;
            if (user) {
                const email = user.identifier || '';
                const phone = user.phoneNumber || '';
                response.redirect(`${frontendUrl}/otp?action=unlock&token=${token}&email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}`);
                return;
            }
        } catch (error) {
            // Fallback to minimal redirect on error
        }

        response.redirect(`${frontendUrl}/otp?action=unlock&token=${token}`);
    }

    // GET /auth/unlock/details
    public async getUnlockDetails(request: Request, response: Response): Promise<void> {
        const token = String(request.query.token || '');
        if (!token) {
            response.status(400).json({ message: 'Your activation link has expired or is invalid. Please contact the Driving School to reactivate your account.' });
            return;
        }

        try {
            const user = typeof this.authService.dependencies.authDao.getUserByUnlockToken === 'function'
                ? await this.authService.dependencies.authDao.getUserByUnlockToken(token)
                : null;

            if (!user) {
                response.status(400).json({ message: 'Your activation link has expired or is invalid. Please contact the Driving School to reactivate your account.' });
                return;
            }

            if (user.unlockTokenExpiresAt && user.unlockTokenExpiresAt.getTime() < Date.now()) {
                response.status(400).json({ message: 'Your activation link has expired or is invalid. Please contact the Driving School to reactivate your account.' });
                return;
            }

            response.status(200).json({
                email: user.identifier,
                phoneNumber: user.phoneNumber,
            });
        } catch (error) {
            response.status(400).json({ message: 'Your activation link has expired or is invalid. Please contact the Driving School to reactivate your account.' });
        }
    }

    // POST /auth/register
    public async register(request: Request, response: Response): Promise<void> {
        const dto = AuthRequestMapper.toRegisterRequestDto(request.body);
        
        const hostTenantSlug = resolveTenantSlug(request.headers);
        if (hostTenantSlug) {
            dto.tenantId = hostTenantSlug;
        }

        const inviterRole = request.authContext?.roles[0];

        try {
            const session = await this.authService.register(dto, inviterRole);
            this.setRefreshTokenCookie(response, session);
            response.status(201).json(AuthResponseMapper.toRegisterResponseDto(session));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const status =
                message.includes('cannot create')
                    || message.includes('self-register')
                    || message.includes('Only Tenant Admin')
                    ? 403
                    : 400;

            response.status(status).json({ message });
        }
    }

    // POST /auth/refresh
    public async refresh(request: Request, response: Response): Promise<void> {
        try {
            let refreshToken = (request as any).cookies?.refresh_token;
            if (!refreshToken) {
                const cookieHeader = request.headers?.cookie;
                if (cookieHeader) {
                    const cookies = cookieHeader.split(';').reduce((acc, c) => {
                        const [name, val] = c.split('=').map(x => x.trim());
                        if (name) acc[name] = val;
                        return acc;
                    }, {} as Record<string, string>);
                    refreshToken = cookies['refresh_token'];
                }
            }

            if (!refreshToken) {
                refreshToken = request.body?.refreshToken;
            }

            if (!refreshToken) {
                response.status(401).json({ message: 'Refresh token is missing.' });
                return;
            }

            const session = await this.authService.refresh({ refreshToken });
            this.setRefreshTokenCookie(response, session);

            response.status(200).json(AuthResponseMapper.toLoginResponseDto(session));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            response.status(401).json({ message });
        }
    }

    // POST /auth/logout
    public async logout(request: Request, response: Response): Promise<void> {
        let refreshToken = (request as any).cookies?.refresh_token;
        if (!refreshToken) {
            const cookieHeader = request.headers?.cookie;
            if (cookieHeader) {
                const cookies = cookieHeader.split(';').reduce((acc, c) => {
                    const [name, val] = c.split('=').map(x => x.trim());
                    if (name) acc[name] = val;
                    return acc;
                }, {} as Record<string, string>);
                refreshToken = cookies['refresh_token'];
            }
        }

        if (!refreshToken) {
            refreshToken = request.body?.refreshToken;
        }

        if (refreshToken) {
            await this.authService.logout({ refreshToken });
        }

        if (typeof response.clearCookie === 'function') {
            response.clearCookie('refresh_token', { path: '/auth' });
        }
        response.status(204).send();
    }

    // POST /auth/otp/generate
    public async generateOtp(request: Request, response: Response): Promise<void> {
        try {
            const { email, phoneNumber, captchaToken, mfaToken, unlockToken } = request.body;

            // Session-based trust bypass: skip CAPTCHA if valid loginStateToken, mfaToken or unlockToken is present
            let skipCaptcha = false;
            let loginStateToken = (request as any).cookies?.login_state_token;
            if (!loginStateToken) {
                const cookieHeader = request.headers.cookie;
                if (cookieHeader) {
                    const cookies = cookieHeader.split(';').reduce((acc, c) => {
                        const [name, val] = c.split('=').map(x => x.trim());
                        if (name) acc[name] = val;
                        return acc;
                    }, {} as Record<string, string>);
                    loginStateToken = cookies['login_state_token'];
                }
            }

            if (loginStateToken) {
                const loginState = await this.getLoginState(loginStateToken);
                if (loginState) {
                    skipCaptcha = true;
                }
            } else if (mfaToken) {
                const tx = await this.mfaTransactionStore.getTransaction(mfaToken);
                if (tx) {
                    skipCaptcha = true;
                }
            } else if (unlockToken) {
                const user = typeof this.authService.dependencies.authDao.getUserByUnlockToken === 'function'
                    ? await this.authService.dependencies.authDao.getUserByUnlockToken(unlockToken)
                    : null;
                if (user && (!user.unlockTokenExpiresAt || user.unlockTokenExpiresAt.getTime() >= Date.now())) {
                    skipCaptcha = true;
                }
            }

            if (!skipCaptcha) {
                const ip = request.ip || request.socket?.remoteAddress;
                const isValidCaptcha = await this.captchaValidator.validate(captchaToken || '', ip);
                if (!isValidCaptcha) {
                    response.status(400).json({ message: 'Invalid CAPTCHA token' });
                    return;
                }
            }

            // Resolve tenant and branch context if present
            const hostTenantSlug = resolveTenantSlug(request.headers);
            const tenantId = hostTenantSlug || (request.headers['x-tenant-id'] as string) || undefined;
            const branchId = (request.headers['x-branch-id'] as string) || undefined;

            const result = await this.otpService.generateOtp({
                email,
                phoneNumber,
                tenantId,
                branchId
            });

            // Set cookie: HttpOnly, secure if in production, maxAge = 5 minutes (5 * 60 * 1000)
            const isProd = process.env.NODE_ENV === 'production';
            response.cookie('otp_token', result.token, {
                httpOnly: true,
                secure: isProd,
                sameSite: 'lax',
                maxAge: 5 * 60 * 1000
            });

            response.status(200).json({
                message: 'OTP generated successfully.',
                token: result.token
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            response.status(400).json({ message });
        }
    }

    // POST /auth/otp/validate
    public async validateOtp(request: Request, response: Response): Promise<void> {
        try {
            const { otp, unlockToken } = request.body;

            // Extract token from cookie (checking both cookies object and raw header fallback)
            let token = (request as any).cookies?.otp_token;
            if (!token) {
                const cookieHeader = request.headers.cookie;
                if (cookieHeader) {
                    const cookies = cookieHeader.split(';').reduce((acc, c) => {
                        const [name, val] = c.split('=').map(x => x.trim());
                        if (name) acc[name] = val;
                        return acc;
                    }, {} as Record<string, string>);
                    token = cookies['otp_token'];
                }
            }

            // Fallback to body token if cookie was not sent/received
            if (!token) {
                token = request.body.token;
            }

            if (!token) {
                response.status(400).json({ message: 'OTP token is missing.' });
                return;
            }

            if (!otp) {
                response.status(400).json({ message: 'OTP code is required.' });
                return;
            }

            const verifiedToken = await this.otpService.validateOtpAndStore(token, otp);

            // Clear the cookie immediately
            if (typeof response.clearCookie === 'function') {
                response.clearCookie('otp_token');
            }

            if (verifiedToken) {
                if (unlockToken) {
                    await this.authService.unlockAccount(unlockToken);
                }

                // Set cookie: HttpOnly, secure in prod, maxAge = 5 minutes
                const isProd = process.env.NODE_ENV === 'production';
                response.cookie('otp_verified_token', verifiedToken, {
                    httpOnly: true,
                    secure: isProd,
                    sameSite: 'lax',
                    maxAge: 5 * 60 * 1000
                });

                response.status(200).json({
                    message: 'OTP verified successfully.',
                    token: verifiedToken
                });
            } else {
                response.status(400).json({ message: 'Invalid or expired OTP.' });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            response.status(400).json({ message });
        }
    }

    // POST /auth/captcha/validate
    public async validateCaptcha(request: Request, response: Response): Promise<void> {
        try {
            const { captchaToken } = request.body;
            const ip = request.ip || request.socket?.remoteAddress;

            if (!this.captchaService) {
                response.status(500).json({ message: 'Captcha Service not configured.' });
                return;
            }

            const token = await this.captchaService.validateAndStore(captchaToken || '', ip);
            if (!token) {
                response.status(400).json({ message: 'Invalid CAPTCHA token' });
                return;
            }

            const isProd = process.env.NODE_ENV === 'production';
            response.cookie('captcha_verified_token', token, {
                httpOnly: true,
                secure: isProd,
                sameSite: 'lax',
                maxAge: 5 * 60 * 1000
            });

            response.status(200).json({
                message: 'CAPTCHA verified successfully.',
                token
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            response.status(400).json({ message });
        }
    }

    // POST /auth/login/complete
    public async completeLogin(request: Request, response: Response): Promise<void> {
        try {
            // 1. Extract and validate master login state token
            let loginStateToken = (request as any).cookies?.login_state_token;
            if (!loginStateToken) {
                const cookieHeader = request.headers.cookie;
                if (cookieHeader) {
                    const cookies = cookieHeader.split(';').reduce((acc, c) => {
                        const [name, val] = c.split('=').map(x => x.trim());
                        if (name) acc[name] = val;
                        return acc;
                    }, {} as Record<string, string>);
                    loginStateToken = cookies['login_state_token'];
                }
            }

            if (!loginStateToken) {
                response.status(401).json({ message: 'Session expired. Please log in again.' });
                return;
            }

            const loginState = await this.getLoginState(loginStateToken);
            if (!loginState) {
                response.status(401).json({ message: 'Session expired. Please log in again.' });
                return;
            }

            // 2. Check CAPTCHA if enabled
            let needsCaptcha = false;
            if (!loginState.captchaVerified && this.captchaValidator) {
                const ip = request.ip || request.socket?.remoteAddress;
                const isBypassed = await this.captchaValidator.validate('', ip);
                needsCaptcha = !isBypassed;
            }

            if (needsCaptcha) {
                let captchaVerifiedToken = (request as any).cookies?.captcha_verified_token;
                if (!captchaVerifiedToken) {
                    const cookieHeader = request.headers.cookie;
                    if (cookieHeader) {
                        const cookies = cookieHeader.split(';').reduce((acc, c) => {
                            const [name, val] = c.split('=').map(x => x.trim());
                            if (name) acc[name] = val;
                            return acc;
                        }, {} as Record<string, string>);
                        captchaVerifiedToken = cookies['captcha_verified_token'];
                    }
                }

                if (!captchaVerifiedToken) {
                    response.status(401).json({ message: 'CAPTCHA verification required.' });
                    return;
                }

                if (!this.captchaService) {
                    response.status(500).json({ message: 'Captcha Service not configured.' });
                    return;
                }

                const isCaptchaValid = await this.captchaService.consumeToken(captchaVerifiedToken);
                if (!isCaptchaValid) {
                    response.status(401).json({ message: 'CAPTCHA verification invalid or expired.' });
                    return;
                }
            }

            // 3. Check OTP if required
            const user = await this.authService.dependencies.authDao.findByIdentifier(loginState.identifier);
            const needsOtp = user && !!user.phoneNumber;

            if (needsOtp) {
                let otpVerifiedToken = (request as any).cookies?.otp_verified_token;
                if (!otpVerifiedToken) {
                    const cookieHeader = request.headers.cookie;
                    if (cookieHeader) {
                        const cookies = cookieHeader.split(';').reduce((acc, c) => {
                            const [name, val] = c.split('=').map(x => x.trim());
                            if (name) acc[name] = val;
                            return acc;
                        }, {} as Record<string, string>);
                        otpVerifiedToken = cookies['otp_verified_token'];
                    }
                }

                if (!otpVerifiedToken) {
                    response.status(401).json({ message: 'OTP verification required.' });
                    return;
                }

                const isOtpValid = await this.otpService.consumeOtpToken(otpVerifiedToken);
                if (!isOtpValid) {
                    response.status(401).json({ message: 'OTP verification invalid or expired.' });
                    return;
                }
            }

            // 4. Issue session and cleanup
            const session = await this.authService.issueSession({
                userId: loginState.userId,
                roles: loginState.roles,
                tenantId: loginState.tenantId,
                branchId: loginState.branchId,
                tokenVersion: loginState.tokenVersion,
                deviceFingerprint: loginState.deviceFingerprint,
                deviceOs: loginState.deviceOs,
                devicePlatform: loginState.devicePlatform,
            }, loginState.rememberMe);

            // Cleanup
            await this.deleteLoginState(loginStateToken);
            if (typeof response.clearCookie === 'function') {
                response.clearCookie('login_state_token');
                response.clearCookie('captcha_verified_token');
                response.clearCookie('otp_verified_token');
            }

            this.setRefreshTokenCookie(response, session);
            response.status(200).json(AuthResponseMapper.toLoginResponseDto({
                sessionId: session.sessionId,
                refreshToken: session.refreshToken,
                accessToken: session.accessToken,
                userId: session.accessContext.userId,
                roles: session.accessContext.roles,
                tenantId: session.accessContext.tenantId,
                branchId: session.accessContext.branchId,
                rememberMe: session.rememberMe,
            }));

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            response.status(400).json({ message });
        }
    }

    // GET /auth/sessions
    public async getActiveSessions(request: Request, response: Response): Promise<void> {
        try {
            const userId = request.authContext?.userId;
            if (!userId) {
                response.status(401).json({ message: 'Unauthorized.' });
                return;
            }

            const sessionService = (this.authService as any).dependencies?.sessionService;
            if (!sessionService || typeof sessionService.getActiveSessionsForUser !== 'function') {
                response.status(501).json({ message: 'Session listing not supported.' });
                return;
            }

            const currentJti = request.authContext?.accessTokenJti;
            const sessions = await sessionService.getActiveSessionsForUser(userId);

            const mappedSessions = sessions.map((s: any) => ({
                sessionId: s.sessionId,
                deviceFingerprint: s.deviceFingerprint ?? null,
                deviceOs: s.deviceOs ?? null,
                devicePlatform: s.devicePlatform ?? null,
                createdAt: s.createdAt,
                expiresAt: s.expiresAt,
                rememberMe: s.rememberMe,
                isCurrent: currentJti && s.accessTokenJti ? s.accessTokenJti === currentJti : false,
            }));

            response.status(200).json({ sessions: mappedSessions });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            response.status(500).json({ message });
        }
    }


    // DELETE /auth/sessions/:sessionId
    public async revokeSession(request: Request, response: Response): Promise<void> {
        try {
            const userId = request.authContext?.userId;
            if (!userId) {
                response.status(401).json({ message: 'Unauthorized.' });
                return;
            }

            const { sessionId } = request.params;
            if (!sessionId) {
                response.status(400).json({ message: 'Session ID is required.' });
                return;
            }

            // Revoke via the auth service logout-by-session path
            await this.authService.revokeSessionById(String(sessionId), String(userId));
            response.status(204).send();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            response.status(400).json({ message });
        }
    }
}