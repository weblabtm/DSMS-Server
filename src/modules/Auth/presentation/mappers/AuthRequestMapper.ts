import type { AuthLoginRequestDto, AuthLogoutRequestDto, AuthRefreshRequestDto, AuthRegisterRequestDto } from '../../application/dtos/AuthDtos.js';

export class AuthRequestMapper {
    public static toLoginRequestDto(body: unknown): AuthLoginRequestDto {
        const payload = body as Partial<AuthLoginRequestDto>;

        return {
            identifier: String(payload.identifier ?? ''),
            password: String(payload.password ?? ''),
            rememberMe: Boolean(payload.rememberMe),
            ...(payload.tenantId ? { tenantId: String(payload.tenantId) } : {}),
            ...(payload.branchId ? { branchId: String(payload.branchId) } : {}),
            ...(payload.deviceId ? { deviceId: String(payload.deviceId) } : {}),
            ...(payload.deviceModel ? { deviceModel: String(payload.deviceModel) } : {}),
            ...(payload.deviceOsVersion ? { deviceOsVersion: String(payload.deviceOsVersion) } : {}),
            ...(payload.devicePlatform ? { devicePlatform: String(payload.devicePlatform) } : {}),
            ...(payload.deviceFingerprint ? { deviceFingerprint: String(payload.deviceFingerprint) } : {}),
            ...(payload.deviceOs ? { deviceOs: String(payload.deviceOs) } : {}),
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
            ...(payload.role ? { role: payload.role } : {}),
        };
    }

    public static toLogoutRequestDto(body: unknown): AuthLogoutRequestDto {
        const payload = body as Partial<AuthLogoutRequestDto>;

        return {
            refreshToken: String(payload.refreshToken ?? ''),
        };
    }
}
