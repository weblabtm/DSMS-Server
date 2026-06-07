import crypto from 'crypto';
import { type RedisClientType } from 'redis';
import { type ICaptchaValidator } from './ICaptchaValidator.js';

/** Full context stored for each captcha verification token. */
export interface CaptchaTokenPayload {
    identifier: string;
    userId: string;
    deviceFingerprint: string;
    deviceOs: string;
    devicePlatform: string;
}

export class CaptchaService {
    private readonly memoryStore = new Map<string, { payload: CaptchaTokenPayload; expiresAt: Date }>();

    constructor(
        private readonly captchaValidator: ICaptchaValidator,
        private readonly redisClient: RedisClientType | null
    ) {}

    public get validator(): ICaptchaValidator {
        return this.captchaValidator;
    }

    /**
     * Validates the raw captcha token with the external provider.
     * On success, issues a short-lived verification token bound to the given
     * identifier, userId, and device context so it cannot be replayed by
     * another user or from a different device.
     *
     * @param token             Raw captcha token from the client.
     * @param ip                Client IP address (passed to validator).
     * @param identifier        User identifier (e.g. email).
     * @param userId            Internal user ID.
     * @param deviceFingerprint Device fingerprint hash.
     * @param deviceOs          Operating system string.
     * @param devicePlatform    Platform string (Desktop / Mobile / Tablet).
     * @returns The verification token UUID, or null if the captcha is invalid.
     */
    public async validateAndStore(
        token: string,
        ip?: string,
        identifier = '',
        userId = '',
        deviceFingerprint = '',
        deviceOs = '',
        devicePlatform = ''
    ): Promise<string | null> {
        const isValid = await this.captchaValidator.validate(token, ip);
        if (!isValid) {
            return null;
        }

        const verificationToken = crypto.randomUUID();
        const payload: CaptchaTokenPayload = { identifier, userId, deviceFingerprint, deviceOs, devicePlatform };

        if (this.redisClient && this.redisClient.isOpen) {
            await this.redisClient.setEx(
                `captcha:verified:${verificationToken}`,
                300,
                JSON.stringify(payload)
            );
        } else {
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
            this.memoryStore.set(verificationToken, { payload, expiresAt });
        }
        return verificationToken;
    }

    /**
     * Resolves a verification token and returns its full stored payload, or
     * null if the token does not exist or has expired.
     * Does NOT consume the token — use consumeToken for that.
     */
    public async resolveToken(token: string): Promise<CaptchaTokenPayload | null> {
        if (!token) return null;

        if (this.redisClient && this.redisClient.isOpen) {
            const raw = await this.redisClient.get(`captcha:verified:${token}`);
            if (!raw) return null;
            try {
                return JSON.parse(raw) as CaptchaTokenPayload;
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
    public async isTokenValid(
        token: string,
        identifier?: string,
        deviceFingerprint?: string
    ): Promise<boolean> {
        const payload = await this.resolveToken(token);
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
    public async consumeToken(
        token: string,
        identifier?: string,
        deviceFingerprint?: string
    ): Promise<CaptchaTokenPayload | null> {
        if (!token) return null;
        const payload = await this.resolveToken(token);
        if (!payload) return null;

        if (identifier !== undefined && payload.identifier !== identifier) return null;
        if (deviceFingerprint !== undefined && payload.deviceFingerprint !== deviceFingerprint) return null;

        // Token is valid — consume (delete) it
        if (this.redisClient && this.redisClient.isOpen) {
            await this.redisClient.del(`captcha:verified:${token}`);
        } else {
            this.memoryStore.delete(token);
        }
        return payload;
    }
}
