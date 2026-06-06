/**
 * Auth data access contract.
 * Implementations can authenticate users from memory, database, or external identity stores.
 */
import { type AuthLoginRequestDto, type AuthPrincipalDto } from '../dtos/AuthDtos.js';
import { type AuthRegisterRequestDto } from '../dtos/AuthDtos.js';

export interface AuthDao {
    authenticate(credentials: AuthLoginRequestDto): Promise<AuthPrincipalDto | null>;

    register(account: AuthRegisterRequestDto): Promise<AuthPrincipalDto>;

    lockAccount(identifier: string, token: string, expiresAt: Date): Promise<void>;

    unlockAccountByToken(token: string): Promise<boolean>;

    isAccountLocked(identifier: string): Promise<boolean>;

    saveOtp(otp: { token: string; otpHash: string; expiresAt: Date }): Promise<void>;

    findOtp(token: string): Promise<{ token: string; otpHash: string; expiresAt: Date } | null>;

    deleteOtp(token: string): Promise<void>;

    deleteExpiredOtps(): Promise<number>;
}