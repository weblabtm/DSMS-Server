import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { type RedisClientType } from 'redis';
import type { AuthDao } from '../dao/AuthDao.js';
import type { IOtpNotificationService } from './IOtpNotificationService.js';
import { CaptchaService } from './CaptchaService.js';

export type OtpGenerateInput = {
    email?: string;
    phoneNumber?: string;
    tenantId?: string;
    branchId?: string;
    captchaToken?: string;
    deviceFingerprint?: string;
    ip?: string;
};

/** Full context stored for each OTP verification token. */
export interface OtpTokenPayload {
    identifier: string;
    userId: string;
    deviceFingerprint: string;
    deviceOs: string;
    devicePlatform: string;
}

export class OtpService {
    private readonly memoryStore = new Map<string, { payload: OtpTokenPayload; expiresAt: Date }>();

    public constructor(
        private readonly authDao: AuthDao,
        private readonly notificationService: IOtpNotificationService,
        private readonly redisClient: RedisClientType | null = null,
        private readonly captchaService: CaptchaService | null = null
    ) {}

    public async generateOtp(input: OtpGenerateInput): Promise<{ token: string; otp: string }> {
        if (this.captchaService) {
            const isBypassed = await this.captchaService.validator.validate('', input.ip || '');
            if (!isBypassed) {
                if (!input.captchaToken) {
                    throw new Error('CAPTCHA verification required.');
                }
                const payload = await this.captchaService.consumeToken(
                    input.captchaToken,
                    undefined,
                    input.deviceFingerprint
                );
                if (!payload) {
                    throw new Error('Invalid or expired CAPTCHA token.');
                }
            }
        }

        let email = input.email;
        let phoneNumber = input.phoneNumber;

        // If email is provided but no phone number (or phone number is masked), look up the user's real phone number
        if (email && (!phoneNumber || phoneNumber.includes('x') || phoneNumber.includes('X'))) {
            const user = await this.authDao.findByIdentifier(email);
            if (user && user.phoneNumber) {
                phoneNumber = user.phoneNumber;
            }
        }

        if (!email && !phoneNumber) {
            throw new Error('At least one recipient (email or phoneNumber) must be provided.');
        }

        const token = crypto.randomUUID();
        // Generate a cryptographically secure 6-digit numeric OTP code
        const otpVal = crypto.randomInt(100000, 1000000).toString();

        const otpHash = await bcrypt.hash(otpVal, 10);

        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

        await this.authDao.saveOtp({ token, otpHash, expiresAt });

        // Decoupled notification sending
        if (email) {
            await this.notificationService.sendOtp(
                email,
                otpVal,
                'email',
                input.tenantId,
                input.branchId
            );
        }

        if (phoneNumber) {
            await this.notificationService.sendOtp(
                phoneNumber,
                otpVal,
                'sms',
                input.tenantId,
                input.branchId
            );
        }

        return { token, otp: otpVal };
    }

    public async validateOtp(token: string, otp: string): Promise<boolean> {
        const record = await this.authDao.findOtp(token);
        if (!record) {
            return false;
        }

        if (new Date() > new Date(record.expiresAt)) {
            await this.authDao.deleteOtp(token);
            return false;
        }

        const isValid = await bcrypt.compare(otp, record.otpHash);

        // Delete immediately on use/attempt to prevent brute forcing
        await this.authDao.deleteOtp(token);

        return isValid;
    }

    /**
     * Validates the raw OTP code and, on success, issues a short-lived
     * verification token bound to the given user/device context so it cannot
     * be replayed by another user or from a different device.
     *
     * @param token             The OTP session token (from cookie / response body).
     * @param otp               The 6-digit code entered by the user.
     * @param identifier        User identifier (e.g. email).
     * @param userId            Internal user ID.
     * @param deviceFingerprint Device fingerprint hash.
     * @param deviceOs          Operating system string.
     * @param devicePlatform    Platform string.
     * @returns The verification token UUID, or null if the OTP is invalid.
     */
    public async validateOtpAndStore(
        token: string,
        otp: string,
        identifier = '',
        userId = '',
        deviceFingerprint = '',
        deviceOs = '',
        devicePlatform = ''
    ): Promise<string | null> {
        const isValid = await this.validateOtp(token, otp);
        if (!isValid) {
            return null;
        }

        const verifiedToken = crypto.randomUUID();
        const payload: OtpTokenPayload = { identifier, userId, deviceFingerprint, deviceOs, devicePlatform };

        if (this.redisClient && this.redisClient.isOpen) {
            await this.redisClient.setEx(
                `otp:verified:${verifiedToken}`,
                300,
                JSON.stringify(payload)
            );
        } else {
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
            this.memoryStore.set(verifiedToken, { payload, expiresAt });
        }
        return verifiedToken;
    }

    /**
     * Resolves a verification token and returns its full stored payload, or
     * null if the token does not exist or has expired.
     * Does NOT consume the token — use consumeOtpToken for that.
     */
    public async resolveOtpToken(token: string): Promise<OtpTokenPayload | null> {
        if (!token) return null;

        if (this.redisClient && this.redisClient.isOpen) {
            const raw = await this.redisClient.get(`otp:verified:${token}`);
            if (!raw) return null;
            try {
                return JSON.parse(raw) as OtpTokenPayload;
            } catch {
                return null;
            }
        } else {
            const entry = this.memoryStore.get(token);
            if (!entry || new Date() > entry.expiresAt) {
                if (entry) this.memoryStore.delete(token);
                return null;
            }
            return entry.payload;
        }
    }

    /**
     * Returns true if the token exists, has not expired, and its stored binding
     * matches the provided identifier + device fingerprint (when supplied).
     */
    public async isOtpTokenValid(
        token: string,
        identifier?: string,
        deviceFingerprint?: string
    ): Promise<boolean> {
        const payload = await this.resolveOtpToken(token);
        if (!payload) return false;

        if (identifier !== undefined && payload.identifier !== identifier) return false;
        if (deviceFingerprint !== undefined && payload.deviceFingerprint !== deviceFingerprint) return false;

        return true;
    }

    /**
     * Single-use consumption: validates the token (including optional binding
     * check), deletes it, and returns the full payload on success or null on
     * failure so callers can access the user/device context without a second
     * lookup.
     */
    public async consumeOtpToken(
        token: string,
        identifier?: string,
        deviceFingerprint?: string
    ): Promise<OtpTokenPayload | null> {
        if (!token) return null;
        const payload = await this.resolveOtpToken(token);
        if (!payload) return null;

        if (identifier !== undefined && payload.identifier !== identifier) return null;
        if (deviceFingerprint !== undefined && payload.deviceFingerprint !== deviceFingerprint) return null;

        // Token is valid — consume (delete) it
        if (this.redisClient && this.redisClient.isOpen) {
            await this.redisClient.del(`otp:verified:${token}`);
        } else {
            this.memoryStore.delete(token);
        }
        return payload;
    }
}
