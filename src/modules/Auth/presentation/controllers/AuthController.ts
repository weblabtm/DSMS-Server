/**
 * HTTP controller for authentication endpoints.
 * It only translates requests to DTOs and returns the service response as JSON.
 */
import type { Request, Response } from 'express';

import { type AuthLoginRequestDto, type AuthLogoutRequestDto, type AuthRefreshRequestDto, type AuthRegisterRequestDto, type AuthLoginResponseDto, type AuthRegisterResponseDto } from '../../application/dtos/AuthDtos.js';
import { AuthService } from '../../application/services/AuthService.js';
import { AuthRequestMapper } from '../mappers/AuthRequestMapper.js';
import { AuthResponseMapper } from '../mappers/AuthResponseMapper.js';

export class AuthController {
    public constructor(private readonly authService: AuthService) { }

    public async login(request: Request, response: Response): Promise<void> {
        const dto = AuthRequestMapper.toLoginRequestDto(request.body);
        const session = await this.authService.login(dto);

        response.status(200).json(AuthResponseMapper.toLoginResponseDto(session));
    }

    public async register(request: Request, response: Response): Promise<void> {
        const dto = AuthRequestMapper.toRegisterRequestDto(request.body);
        const session = await this.authService.register(dto);

        response.status(201).json(AuthResponseMapper.toRegisterResponseDto(session));
    }

    public async refresh(request: Request, response: Response): Promise<void> {
        const dto = AuthRequestMapper.toRefreshRequestDto(request.body);
        const session = await this.authService.refresh(dto);

        response.status(200).json(AuthResponseMapper.toLoginResponseDto(session));
    }

    public async logout(request: Request, response: Response): Promise<void> {
        const dto = AuthRequestMapper.toLogoutRequestDto(request.body);
        await this.authService.logout(dto as never);
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
    // Request/response mapping moved to `presentation/mappers` to keep controller focused
    // and adhere to SRP (see `AuthRequestMapper` and `AuthResponseMapper`).
}