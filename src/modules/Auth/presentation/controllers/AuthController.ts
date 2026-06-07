/**
 * HTTP controller for authentication endpoints.
 * It only translates requests to DTOs and returns the service response as JSON.
 */
import type { Request, Response } from 'express';

import { AuthService } from '../../application/services/AuthService.js';
import { OtpService } from '../../application/services/OtpService.js';
import { type IMfaTransactionStore } from '../../application/services/IMfaTransactionStore.js';
import { type ICaptchaValidator } from '../../application/services/ICaptchaValidator.js';
import { AuthRequestMapper } from '../mappers/AuthRequestMapper.js';
import { AuthResponseMapper } from '../mappers/AuthResponseMapper.js';
import { resolveTenantSlug } from '../../../../shared/utils/tenantResolver.js';

export class AuthController {
    public constructor(
        private readonly authService: AuthService,
        private readonly otpService: OtpService,
        private readonly googleCaptchaValidator: ICaptchaValidator,
        private readonly mfaTransactionStore: IMfaTransactionStore
    ) { }

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
            dto.captchaToken = (request.body as any)?.captchaToken;
            dto.mfaToken = (request.body as any)?.mfaToken;
            
            const hostTenantSlug = resolveTenantSlug(request.headers);
            if (hostTenantSlug) {
                dto.tenantId = hostTenantSlug;
            }

            const session = await this.authService.login(dto);
            this.setRefreshTokenCookie(response, session);

            response.status(200).json(AuthResponseMapper.toLoginResponseDto(session));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message === 'OTP required') {
                const phoneNumber = (error as any).phoneNumber || '';
                const mfaToken = (error as any).mfaToken || '';
                response.status(400).json({ message: 'OTP required', mfaToken, phoneNumber });
                return;
            }
            if (message === 'CAPTCHA required') {
                response.status(400).json({ message: 'CAPTCHA required' });
                return;
            }
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
            const { email, phoneNumber, captchaToken } = request.body;

            // 1. Google reCAPTCHA validation
            const ip = request.ip || request.socket?.remoteAddress;
            const isValidCaptcha = await this.googleCaptchaValidator.validate(captchaToken || '', ip);
            if (!isValidCaptcha) {
                response.status(400).json({ message: 'Invalid CAPTCHA token' });
                return;
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
            const { otp, mfaToken, unlockToken } = request.body;

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

            const isValid = await this.otpService.validateOtp(token, otp);

            // Clear the cookie immediately
            if (typeof response.clearCookie === 'function') {
                response.clearCookie('otp_token');
            }

            if (isValid) {
                if (mfaToken) {
                    await this.mfaTransactionStore.markVerified(mfaToken);
                }
                if (unlockToken) {
                    await this.authService.unlockAccount(unlockToken);
                }
                response.status(200).json({ message: 'OTP verified successfully.' });
            } else {
                response.status(400).json({ message: 'Invalid or expired OTP.' });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            response.status(400).json({ message });
        }
    }
}