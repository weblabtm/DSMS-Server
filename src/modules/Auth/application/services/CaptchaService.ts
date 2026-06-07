import crypto from 'crypto';
import { type RedisClientType } from 'redis';
import { type ICaptchaValidator } from './ICaptchaValidator.js';

export class CaptchaService {
    private readonly memoryStore = new Map<string, { verified: boolean; expiresAt: Date }>();

    constructor(
        private readonly captchaValidator: ICaptchaValidator,
        private readonly redisClient: RedisClientType | null
    ) {}

    public async validateAndStore(token: string, ip?: string): Promise<string | null> {
        const isValid = await this.captchaValidator.validate(token, ip);
        if (!isValid) {
            return null;
        }

        const verificationToken = crypto.randomUUID();
        if (this.redisClient && this.redisClient.isOpen) {
            // Set 5-minute TTL (300 seconds)
            await this.redisClient.setEx(`captcha:verified:${verificationToken}`, 300, 'true');
        } else {
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
            this.memoryStore.set(verificationToken, { verified: true, expiresAt });
        }
        return verificationToken;
    }

    public async isTokenValid(token: string): Promise<boolean> {
        if (!token) return false;
        if (this.redisClient && this.redisClient.isOpen) {
            const exists = await this.redisClient.get(`captcha:verified:${token}`);
            return exists === 'true';
        } else {
            const entry = this.memoryStore.get(token);
            if (!entry || new Date() > entry.expiresAt) {
                if (entry) this.memoryStore.delete(token);
                return false;
            }
            return entry.verified;
        }
    }

    public async consumeToken(token: string): Promise<boolean> {
        if (!token) return false;
        const valid = await this.isTokenValid(token);
        if (valid) {
            if (this.redisClient && this.redisClient.isOpen) {
                await this.redisClient.del(`captcha:verified:${token}`);
            } else {
                this.memoryStore.delete(token);
            }
        }
        return valid;
    }
}
