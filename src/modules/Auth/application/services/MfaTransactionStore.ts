import crypto from 'crypto';
import { type RedisClientType } from 'redis';
import { type IMfaTransactionStore } from './IMfaTransactionStore.js';

export class MfaTransactionStore implements IMfaTransactionStore {
    private readonly memoryStore = new Map<string, { userId: string; rememberMe?: boolean; verified: boolean; expiresAt: Date }>();

    constructor(private readonly redisClient: RedisClientType | null) {}

    public async createTransaction(userId: string, rememberMe?: boolean): Promise<string> {
        const token = crypto.randomUUID();
        if (this.redisClient && this.redisClient.isOpen) {
            const data = JSON.stringify({ userId, rememberMe, verified: false });
            // Set 5-minute TTL (300 seconds)
            await this.redisClient.setEx(`mfa:tx:${token}`, 300, data);
        } else {
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
            this.memoryStore.set(token, { userId, rememberMe, verified: false, expiresAt });
        }
        return token;
    }

    public async getTransaction(token: string): Promise<{ userId: string; rememberMe?: boolean } | null> {
        if (this.redisClient && this.redisClient.isOpen) {
            const data = await this.redisClient.get(`mfa:tx:${token}`);
            if (!data) return null;
            return JSON.parse(data);
        } else {
            const tx = this.memoryStore.get(token);
            if (!tx || new Date() > tx.expiresAt) {
                if (tx) this.memoryStore.delete(token);
                return null;
            }
            return tx;
        }
    }

    public async markVerified(token: string): Promise<void> {
        if (this.redisClient && this.redisClient.isOpen) {
            const data = await this.redisClient.get(`mfa:tx:${token}`);
            if (data) {
                const parsed = JSON.parse(data);
                parsed.verified = true;
                const ttl = await this.redisClient.ttl(`mfa:tx:${token}`);
                const remaining = ttl > 0 ? ttl : 300;
                await this.redisClient.setEx(`mfa:tx:${token}`, remaining, JSON.stringify(parsed));
            }
        } else {
            const tx = this.memoryStore.get(token);
            if (tx && new Date() <= tx.expiresAt) {
                tx.verified = true;
            }
        }
    }

    public async isVerified(token: string): Promise<boolean> {
        if (this.redisClient && this.redisClient.isOpen) {
            const data = await this.redisClient.get(`mfa:tx:${token}`);
            if (!data) return false;
            return JSON.parse(data).verified;
        } else {
            const tx = this.memoryStore.get(token);
            if (!tx || new Date() > tx.expiresAt) {
                return false;
            }
            return tx.verified;
        }
    }

    public async deleteTransaction(token: string): Promise<void> {
        if (this.redisClient && this.redisClient.isOpen) {
            await this.redisClient.del(`mfa:tx:${token}`);
        } else {
            this.memoryStore.delete(token);
        }
    }
}
