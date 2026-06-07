/**
 * Auth data access contract.
 * Implementations can authenticate users from memory, database, or external identity stores.
 */
import { type AuthLoginRequestDto, type AuthPrincipalDto } from '../dtos/AuthDtos.js';
import { type AuthRegisterRequestDto } from '../dtos/AuthDtos.js';

export interface AuthDao {
    authenticate(credentials: AuthLoginRequestDto): Promise<AuthPrincipalDto | null>;

    findByIdentifier(identifier: string): Promise<(AuthPrincipalDto & { phoneNumber?: string | null }) | null>;

    register(account: AuthRegisterRequestDto): Promise<AuthPrincipalDto>;

    lockAccount(identifier: string, token: string, expiresAt: Date): Promise<void>;

    unlockAccountByToken(token: string): Promise<boolean>;

    isAccountLocked(identifier: string): Promise<boolean>;

    getUserLockStatus(identifier: string): Promise<{ isLocked: boolean; lockedAt: Date | null; unlockToken: string | null; unlockTokenExpiresAt: Date | null; lockoutCount: number; phoneNumber: string | null; reminder1hSent: boolean; reminder30mSent: boolean; reminder10mSent: boolean } | null>;

    incrementLockoutCount(identifier: string): Promise<void>;

    resetLockoutCount(identifier: string): Promise<void>;

    lockAccountTemporarily(identifier: string, expiresAt: Date): Promise<void>;

    lockAccountPermanently(identifier: string, token: string, expiresAt: Date): Promise<void>;

    unlockAccountAutomatically(identifier: string): Promise<void>;

    getUserByUnlockToken(token: string): Promise<{ id: string; identifier: string; phoneNumber: string | null; unlockTokenExpiresAt: Date | null } | null>;

    findActiveLockedUsers(): Promise<Array<{ id: string; identifier: string; unlockToken: string; unlockTokenExpiresAt: Date; reminder1hSent: boolean; reminder30mSent: boolean; reminder10mSent: boolean; tenantId?: string; branchId?: string }>>;

    updateReminderSent(userId: string, field: 'reminder1hSent' | 'reminder30mSent' | 'reminder10mSent', value: boolean): Promise<void>;

    saveOtp(otp: { token: string; otpHash: string; expiresAt: Date }): Promise<void>;

    findOtp(token: string): Promise<{ token: string; otpHash: string; expiresAt: Date } | null>;

    deleteOtp(token: string): Promise<void>;

    deleteExpiredOtps(): Promise<number>;

    syncDevice(device: {
        deviceId: string;
        userId: string;
        model?: string;
        osVersion?: string;
        platform?: string;
    }): Promise<void>;

    /**
     * Returns the trust level for a device fingerprint belonging to the given user.
     *  - 'full'    → trustedAt < 15 days ago  → skip Captcha + OTP
     *  - 'partial' → trustedAt 15–30 days ago → skip OTP only, require Captcha
     *  - 'none'    → no trust record or trust expired (>30 days)
     */
    getDeviceTrustStatus(userId: string, deviceFingerprint: string): Promise<'full' | 'partial' | 'none'>;

    /**
     * Marks a device as trusted now. Uses the deviceFingerprint as the deviceId.
     * Upserts the Device row and stamps trustedAt = now().
     */
    trustDevice(userId: string, deviceFingerprint: string): Promise<void>;
}