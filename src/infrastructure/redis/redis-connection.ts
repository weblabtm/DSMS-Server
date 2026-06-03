import { createClient, type RedisClientType } from 'redis';

export class RedisConnection {
    private readonly client: RedisClientType | null;

    private readonly normalizedRedisUrl: string | null;

    private isConnected = false;

    private lastError: string | null = null;

    public constructor(private readonly redisUrl: string) {
        this.normalizedRedisUrl = this.normalizeRedisUrl(redisUrl);

        if (!this.normalizedRedisUrl) {
            this.client = null;
            this.lastError = 'REDIS_URL is missing or invalid.';
            console.error('Redis disabled: REDIS_URL is missing or invalid.');
            return;
        }

        this.client = createClient({
            url: this.normalizedRedisUrl,
        });

        this.client.on('error', (error) => {
            this.isConnected = false;
            this.lastError = error instanceof Error ? error.message : String(error);
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
                this.isConnected = true;
                this.lastError = null;
            } catch (error) {
                this.isConnected = false;
                this.lastError = error instanceof Error ? error.message : String(error);
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
            this.isConnected = false;
        }
    }

    public getClient(): RedisClientType | null {
        return this.client;
    }

    public async getHealthStatus(): Promise<{ connected: boolean; error?: string }> {
        if (!this.client) {
            return {
                connected: false,
                error: this.lastError ?? 'Redis client is not configured.',
            };
        }

        try {
            const pingResponse = await this.client.ping();

            if (pingResponse === 'PONG') {
                this.isConnected = true;
                this.lastError = null;
                return { connected: true };
            }

            this.isConnected = false;
            this.lastError = `Unexpected Redis ping response: ${pingResponse}`;
            return {
                connected: false,
                error: this.lastError,
            };
        } catch (error) {
            this.isConnected = false;
            this.lastError = error instanceof Error ? error.message : String(error);
            return {
                connected: false,
                error: this.lastError,
            };
        }
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