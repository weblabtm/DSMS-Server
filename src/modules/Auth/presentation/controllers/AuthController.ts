/**
 * HTTP controller for authentication endpoints.
 * It only translates requests to DTOs and returns the service response as JSON.
 */
import type { Request, Response } from 'express';

import { type AuthLoginRequestDto, type AuthLogoutRequestDto, type AuthRefreshRequestDto, type AuthRegisterRequestDto, type AuthLoginResponseDto, type AuthRegisterResponseDto } from '../../application/dtos/AuthDtos.js';
import { AuthService } from '../../application/services/AuthService.js';

export class AuthController {
    public constructor(private readonly authService: AuthService) { }

    public async login(request: Request, response: Response): Promise<void> {
        const dto = this.toLoginRequestDto(request.body);
        const session = await this.authService.login(dto);

        response.status(200).json(this.toLoginResponseDto(session));
    }

    public async register(request: Request, response: Response): Promise<void> {
        const dto = this.toRegisterRequestDto(request.body);
        const session = await this.authService.register(dto);

        response.status(201).json(this.toRegisterResponseDto(session));
    }

    public async refresh(request: Request, response: Response): Promise<void> {
        const dto = this.toRefreshRequestDto(request.body);
        const session = await this.authService.refresh(dto);

        response.status(200).json(this.toLoginResponseDto(session));
    }

    public logout(request: Request, response: Response): void {
        const dto = this.toLogoutRequestDto(request.body);
        this.authService.logout(dto);

        response.status(204).send();
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

    private toRegisterRequestDto(body: unknown): AuthRegisterRequestDto {
        const payload = body as Partial<AuthRegisterRequestDto>;

        return {
            identifier: String(payload.identifier ?? ''),
            password: String(payload.password ?? ''),
            ...(payload.tenantId ? { tenantId: String(payload.tenantId) } : {}),
            ...(payload.branchId ? { branchId: String(payload.branchId) } : {}),
        };
    }

    private toLogoutRequestDto(body: unknown): AuthLogoutRequestDto {
        const payload = body as Partial<AuthLogoutRequestDto>;

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

    private toRegisterResponseDto(session: AuthRegisterResponseDto): AuthRegisterResponseDto {
        return this.toLoginResponseDto(session);
    }
}