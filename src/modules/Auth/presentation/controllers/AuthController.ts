/**
 * HTTP controller for login and token refresh.
 * It only translates requests to DTOs and returns the service response as JSON.
 */
import type { Request, Response } from 'express';

import { type AuthLoginRequestDto, type AuthRefreshRequestDto, type AuthLoginResponseDto } from '../../application/dtos/AuthDtos.js';
import { AuthService } from '../../application/services/AuthService.js';

export class AuthController {
    public constructor(private readonly authService: AuthService) { }

    public async login(request: Request, response: Response): Promise<void> {
        const dto = this.toLoginRequestDto(request.body);
        const session = await this.authService.login(dto);

        response.status(200).json(this.toLoginResponseDto(session));
    }

    public async refresh(request: Request, response: Response): Promise<void> {
        const dto = this.toRefreshRequestDto(request.body);
        const session = await this.authService.refresh(dto);

        response.status(200).json(this.toLoginResponseDto(session));
    }

    private toLoginRequestDto(body: unknown): AuthLoginRequestDto {
        const payload = body as Partial<AuthLoginRequestDto>;

        return {
            identifier: String(payload.identifier ?? ''),
            password: String(payload.password ?? ''),
            ...(payload.tenantId ? { tenantId: String(payload.tenantId) } : {}),
            ...(payload.branchId ? { branchId: String(payload.branchId) } : {}),
        };
    }

    private toRefreshRequestDto(body: unknown): AuthRefreshRequestDto {
        const payload = body as Partial<AuthRefreshRequestDto>;

        return {
            refreshToken: String(payload.refreshToken ?? ''),
        };
    }

    private toLoginResponseDto(session: AuthLoginResponseDto): AuthLoginResponseDto {
        return {
            sessionId: session.sessionId,
            refreshToken: session.refreshToken,
            accessToken: session.accessToken,
            userId: session.userId,
            roles: [...session.roles],
            ...(session.tenantId ? { tenantId: session.tenantId } : {}),
            ...(session.branchId ? { branchId: session.branchId } : {}),
        };
    }
}