import type { AuthLoginResponseDto, AuthRegisterResponseDto } from '../../application/dtos/AuthDtos.js';

export class AuthResponseMapper {
    public static toLoginResponseDto(session: AuthLoginResponseDto): AuthLoginResponseDto {
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

    public static toRegisterResponseDto(session: AuthRegisterResponseDto): AuthRegisterResponseDto {
        return this.toLoginResponseDto(session as unknown as AuthLoginResponseDto) as AuthRegisterResponseDto;
    }
}
