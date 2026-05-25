import { createClient, type RedisClientType } from 'redis';

export class RedisConnection {
    private readonly client: RedisClientType | null;

    private readonly normalizedRedisUrl: string | null;

    public constructor(private readonly redisUrl: string) {
        this.normalizedRedisUrl = this.normalizeRedisUrl(redisUrl);

        if (!this.normalizedRedisUrl) {
            this.client = null;
            console.error('Redis disabled: REDIS_URL is missing or invalid.');
            return;
        }

        this.client = createClient({
            url: this.normalizedRedisUrl,
        });

        this.client.on('error', (error) => {
            console.error('Redis client error:', error);
        });
    }

    public async connect(): Promise<void> {
        if (!this.client) {
            return;
        }

        if (!this.client.isOpen) {
            try {
                await this.client.connect();
            } catch (error) {
                console.error('Redis connection failed. Continuing without Redis.', error);
                return;
            }
        }

        console.log(`Redis connected (${this.normalizedRedisUrl})`);
    }

    public async disconnect(): Promise<void> {
        if (!this.client) {
            return;
        }

        if (this.client.isOpen) {
            await this.client.quit();
        }
    }

    public getClient(): RedisClientType | null {
        return this.client;
    }

    private normalizeRedisUrl(value: string | undefined): string | null {
        if (!value) {
            return null;
        }

        const trimmedValue = value.trim();
        const match = trimmedValue.match(/rediss?:\/\/\S+/i);
        let url = match ? match[0] : trimmedValue;

        if (trimmedValue.includes('--tls') && url.startsWith('redis://')) {
            url = `rediss://${url.substring('redis://'.length)}`;
        }

        url = url.replace(/["'`]+$/g, '');

        try {
            const parsedUrl = new URL(url);

            if (parsedUrl.protocol !== 'redis:' && parsedUrl.protocol !== 'rediss:') {
                return null;
            }

            return parsedUrl.toString();
        } catch {
            return null;
        }
    }
}