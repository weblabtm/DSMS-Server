import type { IBruteForceStore } from '../application/services/BruteForceProtectionService.js';
import type { RedisConnection } from '../../../infrastructure/redis/redis-connection.js';

export class RedisBruteForceStore implements IBruteForceStore {
    private readonly inMemoryFallback: Map<string, { timestamp: number }[]> = new Map();

    public constructor(private readonly redisConnection: RedisConnection | null | undefined) {}

    public async logAttempt(key: string, timestamp: number, ttlSeconds: number): Promise<number> {
        const client = this.redisConnection?.getClient();
        if (client) {
            try {
                const uniqueVal = `${timestamp}-${Math.random().toString(36).substring(2, 11)}`;
                await client.zAdd(key, {
                    score: timestamp,
                    value: uniqueVal,
                });
                await client.expire(key, ttlSeconds);
                return await client.zCard(key);
            } catch (error) {
                console.error('[RedisBruteForceStore] logAttempt error, using in-memory fallback:', error);
            }
        }

        if (!this.inMemoryFallback.has(key)) {
            this.inMemoryFallback.set(key, []);
        }
        this.inMemoryFallback.get(key)!.push({ timestamp });
        return this.inMemoryFallback.get(key)!.length;
    }

    public async getAttemptCount(key: string, minTimestamp: number): Promise<number> {
        const client = this.redisConnection?.getClient();
        if (client) {
            try {
                await client.zRemRangeByScore(key, 0, minTimestamp - 1);
                return await client.zCard(key);
            } catch (error) {
                console.error('[RedisBruteForceStore] getAttemptCount error, using in-memory fallback:', error);
            }
        }

        const attempts = this.inMemoryFallback.get(key) || [];
        const validAttempts = attempts.filter((a) => a.timestamp >= minTimestamp);
        this.inMemoryFallback.set(key, validAttempts);
        return validAttempts.length;
    }

    public async resetAttempts(key: string): Promise<void> {
        const client = this.redisConnection?.getClient();
        if (client) {
            try {
                await client.del(key);
                return;
            } catch (error) {
                console.error('[RedisBruteForceStore] resetAttempts error, using in-memory fallback:', error);
            }
        }

        this.inMemoryFallback.delete(key);
    }
}
