/**
 * Data transfer objects used by the Auth module.
 * These shapes keep controllers, services, and DAOs decoupled from HTTP payloads.
 */
import { type RoleName } from '../../domain/Role.js';

export type AuthLoginRequestDto = {
    identifier: string;
    password: string;
    tenantId?: string;
    branchId?: string;
};

export type AuthRegisterRequestDto = {
    identifier: string;
    password: string;
    tenantId?: string;
    branchId?: string;
};

export type AuthRefreshRequestDto = {
    refreshToken: string;
};

export type AuthLogoutRequestDto = {
    refreshToken: string;
};

export type AuthPrincipalDto = {
    userId: string;
    roles: readonly RoleName[];
    tenantId?: string;
    branchId?: string;
    tokenVersion?: number;
};

export type AuthSessionResponseDto = {
    sessionId: string;
    refreshToken: string;
    accessToken: string;
    userId: string;
    roles: RoleName[];
    tenantId?: string;
    branchId?: string;
};

export type AuthLoginResponseDto = AuthSessionResponseDto;

export type AuthRegisterResponseDto = AuthSessionResponseDto;