import type { AuthLoginRequestDto, AuthLogoutRequestDto, AuthRefreshRequestDto, AuthRegisterRequestDto } from '../../application/dtos/AuthDtos.js';

export class AuthRequestMapper {
    public static toLoginRequestDto(body: unknown): AuthLoginRequestDto {
        const payload = body as Partial<AuthLoginRequestDto>;

        return {
            identifier: String(payload.identifier ?? ''),
            password: String(payload.password ?? ''),
            ...(payload.tenantId ? { tenantId: String(payload.tenantId) } : {}),
            ...(payload.branchId ? { branchId: String(payload.branchId) } : {}),
        };
    }

    public static toRefreshRequestDto(body: unknown): AuthRefreshRequestDto {
        const payload = body as Partial<AuthRefreshRequestDto>;

        return {
            refreshToken: String(payload.refreshToken ?? ''),
        };
    }

    public static toRegisterRequestDto(body: unknown): AuthRegisterRequestDto {
        const payload = body as Partial<AuthRegisterRequestDto>;

        return {
            identifier: String(payload.identifier ?? ''),
            password: String(payload.password ?? ''),
            ...(payload.tenantId ? { tenantId: String(payload.tenantId) } : {}),
            ...(payload.branchId ? { branchId: String(payload.branchId) } : {}),
        };
    }

    public static toLogoutRequestDto(body: unknown): AuthLogoutRequestDto {
        const payload = body as Partial<AuthLogoutRequestDto>;

        return {
            refreshToken: String(payload.refreshToken ?? ''),
        };
    }
}
