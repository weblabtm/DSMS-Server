import type { AuthLoginRequestDto, AuthLogoutRequestDto, AuthRefreshRequestDto, AuthRegisterRequestDto } from '../../application/dtos/AuthDtos.js';
import type { TenantRoutingContext } from '../../../../shared/request-context.js';

export class AuthRequestMapper {
    public static toLoginRequestDto(body: unknown, tenantContext?: TenantRoutingContext): AuthLoginRequestDto {
        const payload = body as Partial<AuthLoginRequestDto>;
        const tenantId = tenantContext?.tenantSlug ?? (payload.tenantId ? String(payload.tenantId) : undefined);

        return {
            identifier: String(payload.identifier ?? ''),
            password: String(payload.password ?? ''),
            ...(tenantId ? { tenantId } : {}),
            ...(payload.branchId ? { branchId: String(payload.branchId) } : {}),
        };
    }

    public static toRefreshRequestDto(body: unknown): AuthRefreshRequestDto {
        const payload = body as Partial<AuthRefreshRequestDto>;

        return {
            refreshToken: String(payload.refreshToken ?? ''),
        };
    }

    public static toRegisterRequestDto(body: unknown, tenantContext?: TenantRoutingContext): AuthRegisterRequestDto {
        const payload = body as Partial<AuthRegisterRequestDto>;
        const tenantId = tenantContext?.tenantSlug ?? (payload.tenantId ? String(payload.tenantId) : undefined);

        return {
            identifier: String(payload.identifier ?? ''),
            password: String(payload.password ?? ''),
            ...(tenantId ? { tenantId } : {}),
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
