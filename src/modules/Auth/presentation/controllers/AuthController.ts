/**
 * HTTP controller for authentication endpoints.
 * It only translates requests to DTOs and returns the service response as JSON.
 */
import type { Request, Response } from 'express';

import { AuthService } from '../../application/services/AuthService.js';
import { AuthRequestMapper } from '../mappers/AuthRequestMapper.js';
import { AuthResponseMapper } from '../mappers/AuthResponseMapper.js';
import { resolveTenantSlug } from '../../../../shared/utils/tenantResolver.js';

export class AuthController {
    public constructor(private readonly authService: AuthService) { }

    // POST /auth/login
    public async login(request: Request, response: Response): Promise<void> {
        try {
            const dto = AuthRequestMapper.toLoginRequestDto(request.body);
            dto.ipAddress = request.ip || request.socket?.remoteAddress;
            dto.captchaToken = (request.body as any)?.captchaToken;
            
            const hostTenantSlug = resolveTenantSlug(request.headers);
            if (hostTenantSlug) {
                dto.tenantId = hostTenantSlug;
            }

            const session = await this.authService.login(dto);

            response.status(200).json(AuthResponseMapper.toLoginResponseDto(session));
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

        try {
            const success = await this.authService.unlockAccount(token);
            if (success) {
                response.status(200).json({ message: 'Account successfully unlocked. You can now log in.' });
            } else {
                response.status(400).json({ message: 'Invalid or expired unlock token.' });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            response.status(400).json({ message });
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
            const dto = AuthRequestMapper.toRefreshRequestDto(request.body);
            const session = await this.authService.refresh(dto);

            response.status(200).json(AuthResponseMapper.toLoginResponseDto(session));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            response.status(401).json({ message });
        }
    }

    // POST /auth/logout
    public async logout(request: Request, response: Response): Promise<void> {
        const dto = AuthRequestMapper.toLogoutRequestDto(request.body);
        await this.authService.logout(dto as never);
        response.status(204).send();
    }
}