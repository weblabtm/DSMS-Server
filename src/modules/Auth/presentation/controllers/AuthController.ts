/**
 * HTTP controller for authentication endpoints.
 * It only translates requests to DTOs and returns the service response as JSON.
 */
import type { Request, Response } from 'express';

import { AuthService } from '../../application/services/AuthService.js';
import { AuthRequestMapper } from '../mappers/AuthRequestMapper.js';
import { AuthResponseMapper } from '../mappers/AuthResponseMapper.js';

export class AuthController {
    public constructor(private readonly authService: AuthService) { }

    // POST /auth/login
    public async login(request: Request, response: Response): Promise<void> {
        const dto = AuthRequestMapper.toLoginRequestDto(request.body);
        const session = await this.authService.login(dto);

        response.status(200).json(AuthResponseMapper.toLoginResponseDto(session));
    }

    // POST /auth/register
    public async register(request: Request, response: Response): Promise<void> {
        const dto = AuthRequestMapper.toRegisterRequestDto(request.body);
        const inviterRole = request.authContext?.roles[0];

        if (!inviterRole) {
            response.status(401).json({ message: 'Unauthorized' });
            return;
        }

        try {
            const session = await this.authService.register(dto, inviterRole);
            response.status(201).json(AuthResponseMapper.toRegisterResponseDto(session));
        } catch (error) {
            response.status(400).json({ message: error instanceof Error ? error.message : String(error) });
        }
    }

    // POST /auth/refresh
    public async refresh(request: Request, response: Response): Promise<void> {
        const dto = AuthRequestMapper.toRefreshRequestDto(request.body);
        const session = await this.authService.refresh(dto);

        response.status(200).json(AuthResponseMapper.toLoginResponseDto(session));
    }

    // POST /auth/logout
    public async logout(request: Request, response: Response): Promise<void> {
        const dto = AuthRequestMapper.toLogoutRequestDto(request.body);
        await this.authService.logout(dto as never);
        response.status(204).send();
    }
}