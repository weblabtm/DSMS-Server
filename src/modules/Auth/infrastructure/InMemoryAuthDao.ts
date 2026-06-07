/**
 * Simple in-memory Auth DAO used for local development and tests.
 * Replace this with a database-backed implementation when persistence is ready.
 */
import { type AuthDao } from '../application/dao/AuthDao.js';
import { type AuthLoginRequestDto, type AuthPrincipalDto, type AuthRegisterRequestDto } from '../application/dtos/AuthDtos.js';

type AuthSeed = AuthPrincipalDto & {
    identifier: string;
    password: string;
    phoneNumber?: string;
    isLocked?: boolean;
    lockedAt?: Date;
    unlockToken?: string;
    unlockTokenExpiresAt?: Date;
    lockoutCount?: number;
    reminder1hSent?: boolean;
    reminder30mSent?: boolean;
    reminder10mSent?: boolean;
};

export class InMemoryAuthDao implements AuthDao {
    private readonly usersByIdentifier = new Map<string, AuthSeed>();
    private readonly otps = new Map<string, { token: string; otpHash: string; expiresAt: Date }>();

    public constructor(seedUsers: AuthSeed[] = []) {
        for (const user of seedUsers) {
            this.usersByIdentifier.set(user.identifier, user);
        }
    }

    public async findByIdentifier(identifier: string): Promise<(AuthPrincipalDto & { phoneNumber?: string | null }) | null> {
        const user = this.usersByIdentifier.get(identifier);
        if (!user) return null;
        return {
            userId: user.userId,
            roles: user.roles,
            tenantId: user.tenantId,
            branchId: user.branchId,
            tokenVersion: user.tokenVersion,
            phoneNumber: user.phoneNumber || null,
        };
    }

    public async authenticate(credentials: AuthLoginRequestDto): Promise<AuthPrincipalDto | null> {
        const user = this.usersByIdentifier.get(credentials.identifier);

        if (!user || user.password !== credentials.password) {
            return null;
        }

        if (credentials.tenantId && user.tenantId && credentials.tenantId !== user.tenantId) {
            return null;
        }

        if (credentials.branchId && user.branchId && credentials.branchId !== user.branchId) {
            return null;
        }

        const { identifier: _identifier, password: _password, isLocked: _isLocked, unlockToken: _unlockToken, unlockTokenExpiresAt: _unlockTokenExpiresAt, ...principal } = user;

        return principal;
    }

    public async register(account: AuthRegisterRequestDto): Promise<AuthPrincipalDto> {
        if (this.usersByIdentifier.has(account.identifier)) {
            throw new Error('Account already exists');
        }

        const principal: AuthSeed = {
            identifier: account.identifier,
            password: account.password,
            userId: `user-${this.usersByIdentifier.size + 1}`,
            roles: [account.role ?? 'Student'],
            ...(account.tenantId ? { tenantId: account.tenantId } : {}),
            ...(account.branchId ? { branchId: account.branchId } : {}),
            isLocked: false,
        };

        this.usersByIdentifier.set(account.identifier, principal);

        const { identifier: _identifier, password: _password, isLocked: _isLocked, unlockToken: _unlockToken, unlockTokenExpiresAt: _unlockTokenExpiresAt, ...authPrincipal } = principal;

        return authPrincipal;
    }

    public async lockAccount(identifier: string, token: string, expiresAt: Date): Promise<void> {
        const user = this.usersByIdentifier.get(identifier);
        if (user) {
            user.isLocked = true;
            user.lockedAt = new Date();
            user.unlockToken = token;
            user.unlockTokenExpiresAt = expiresAt;
            user.reminder1hSent = false;
            user.reminder30mSent = false;
            user.reminder10mSent = false;
        }
    }

    public async unlockAccountByToken(token: string): Promise<boolean> {
        for (const user of this.usersByIdentifier.values()) {
            if (user.unlockToken === token) {
                // Check expiry
                if (user.unlockTokenExpiresAt && user.unlockTokenExpiresAt.getTime() < Date.now()) {
                    return false;
                }
                user.isLocked = false;
                user.lockedAt = undefined;
                user.unlockToken = undefined;
                user.unlockTokenExpiresAt = undefined;
                user.lockoutCount = 0;
                user.reminder1hSent = false;
                user.reminder30mSent = false;
                user.reminder10mSent = false;
                return true;
            }
        }
        return false;
    }

    public async isAccountLocked(identifier: string): Promise<boolean> {
        const user = this.usersByIdentifier.get(identifier);
        return !!user?.isLocked;
    }

    public async getUserLockStatus(identifier: string): Promise<{ isLocked: boolean; lockedAt: Date | null; unlockToken: string | null; unlockTokenExpiresAt: Date | null; lockoutCount: number; phoneNumber: string | null; reminder1hSent: boolean; reminder30mSent: boolean; reminder10mSent: boolean } | null> {
        const user = this.usersByIdentifier.get(identifier);
        if (!user) return null;
        return {
            isLocked: !!user.isLocked,
            lockedAt: user.lockedAt || null,
            unlockToken: user.unlockToken || null,
            unlockTokenExpiresAt: user.unlockTokenExpiresAt || null,
            lockoutCount: user.lockoutCount || 0,
            phoneNumber: user.phoneNumber || null,
            reminder1hSent: !!user.reminder1hSent,
            reminder30mSent: !!user.reminder30mSent,
            reminder10mSent: !!user.reminder10mSent,
        };
    }

    public async incrementLockoutCount(identifier: string): Promise<void> {
        const user = this.usersByIdentifier.get(identifier);
        if (user) {
            user.lockoutCount = (user.lockoutCount || 0) + 1;
        }
    }

    public async resetLockoutCount(identifier: string): Promise<void> {
        const user = this.usersByIdentifier.get(identifier);
        if (user) {
            user.lockoutCount = 0;
            user.reminder1hSent = false;
            user.reminder30mSent = false;
            user.reminder10mSent = false;
        }
    }

    public async lockAccountTemporarily(identifier: string, expiresAt: Date): Promise<void> {
        const user = this.usersByIdentifier.get(identifier);
        if (user) {
            user.isLocked = true;
            user.lockedAt = new Date();
            user.unlockToken = undefined;
            user.unlockTokenExpiresAt = expiresAt;
            user.reminder1hSent = false;
            user.reminder30mSent = false;
            user.reminder10mSent = false;
        }
    }

    public async lockAccountPermanently(identifier: string, token: string, expiresAt: Date): Promise<void> {
        const user = this.usersByIdentifier.get(identifier);
        if (user) {
            user.isLocked = true;
            user.lockedAt = new Date();
            user.unlockToken = token;
            user.unlockTokenExpiresAt = expiresAt;
            user.reminder1hSent = false;
            user.reminder30mSent = false;
            user.reminder10mSent = false;
        }
    }

    public async unlockAccountAutomatically(identifier: string): Promise<void> {
        const user = this.usersByIdentifier.get(identifier);
        if (user) {
            user.isLocked = false;
            user.lockedAt = undefined;
            user.unlockToken = undefined;
            user.unlockTokenExpiresAt = undefined;
        }
    }

    public async getUserByUnlockToken(token: string): Promise<{ id: string; identifier: string; phoneNumber: string | null; unlockTokenExpiresAt: Date | null } | null> {
        for (const user of this.usersByIdentifier.values()) {
            if (user.unlockToken === token) {
                return {
                    id: user.userId,
                    identifier: user.identifier,
                    phoneNumber: user.phoneNumber || null,
                    unlockTokenExpiresAt: user.unlockTokenExpiresAt || null,
                };
            }
        }
        return null;
    }

    public async findActiveLockedUsers(): Promise<Array<{ id: string; identifier: string; unlockToken: string; unlockTokenExpiresAt: Date; reminder1hSent: boolean; reminder30mSent: boolean; reminder10mSent: boolean; tenantId?: string; branchId?: string }>> {
        const now = new Date();
        const active: any[] = [];
        for (const user of this.usersByIdentifier.values()) {
            if (user.isLocked && user.unlockToken && user.unlockTokenExpiresAt && user.unlockTokenExpiresAt > now) {
                active.push({
                    id: user.userId,
                    identifier: user.identifier,
                    unlockToken: user.unlockToken,
                    unlockTokenExpiresAt: user.unlockTokenExpiresAt,
                    reminder1hSent: !!user.reminder1hSent,
                    reminder30mSent: !!user.reminder30mSent,
                    reminder10mSent: !!user.reminder10mSent,
                    tenantId: user.tenantId,
                    branchId: user.branchId,
                });
            }
        }
        return active;
    }

    public async updateReminderSent(userId: string, field: 'reminder1hSent' | 'reminder30mSent' | 'reminder10mSent', value: boolean): Promise<void> {
        for (const user of this.usersByIdentifier.values()) {
            if (user.userId === userId) {
                user[field] = value;
                break;
            }
        }
    }

    public async saveOtp(otp: { token: string; otpHash: string; expiresAt: Date }): Promise<void> {
        this.otps.set(otp.token, { ...otp });
    }

    public async findOtp(token: string): Promise<{ token: string; otpHash: string; expiresAt: Date } | null> {
        const otp = this.otps.get(token);
        return otp ? { ...otp } : null;
    }

    public async deleteOtp(token: string): Promise<void> {
        this.otps.delete(token);
    }

    public async deleteExpiredOtps(): Promise<number> {
        let count = 0;
        const now = new Date();
        for (const [token, otp] of this.otps.entries()) {
            if (now > otp.expiresAt) {
                this.otps.delete(token);
                count++;
            }
        }
        return count;
    }

    private readonly devices: Array<{ deviceId: string; userId: string; model?: string; osVersion?: string; platform?: string; trustedAt?: Date }> = [];

    public async syncDevice(device: {
        deviceId: string;
        userId: string;
        model?: string;
        osVersion?: string;
        platform?: string;
    }): Promise<void> {
        const existing = this.devices.find(d => d.userId === device.userId && d.deviceId === device.deviceId);
        if (existing) {
            existing.model = device.model;
            existing.osVersion = device.osVersion;
            existing.platform = device.platform;
        } else {
            this.devices.push({ ...device });
        }
    }

    public async getDeviceTrustStatus(userId: string, deviceFingerprint: string): Promise<'full' | 'partial' | 'none'> {
        if (!deviceFingerprint) return 'none';
        const record = this.devices.find(d => d.userId === userId && d.deviceId === deviceFingerprint);
        if (!record || !record.trustedAt) return 'none';

        const ageMs = Date.now() - record.trustedAt.getTime();
        const FULL_TRUST_MS = 15 * 24 * 60 * 60 * 1000;
        const MAX_TRUST_MS  = 30 * 24 * 60 * 60 * 1000;

        if (ageMs > MAX_TRUST_MS) return 'none';
        if (ageMs > FULL_TRUST_MS) return 'partial';
        return 'full';
    }

    public async trustDevice(userId: string, deviceFingerprint: string): Promise<void> {
        if (!deviceFingerprint) return;
        const existing = this.devices.find(d => d.userId === userId && d.deviceId === deviceFingerprint);
        if (existing) {
            existing.trustedAt = new Date();
        } else {
            this.devices.push({ deviceId: deviceFingerprint, userId, trustedAt: new Date() });
        }
    }
}