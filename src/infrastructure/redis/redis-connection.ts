import { createClient, type RedisClientType } from 'redis';

export class RedisConnection {
    private readonly client: RedisClientType;

    public constructor(private readonly redisUrl: string) {
        if (!redisUrl) {
            throw new Error('REDIS_URL is required to start the server.');
        }

        this.client = createClient({
            url: redisUrl,
        });

        this.client.on('error', (error) => {
            console.error('Redis client error:', error);
        });
    }

    public async connect(): Promise<void> {
        if (!this.client.isOpen) {
            await this.client.connect();
        }

        console.log('Redis connected');
    }

    public async disconnect(): Promise<void> {
        if (this.client.isOpen) {
            await this.client.quit();
        }
    }

    public getClient(): RedisClientType {
        return this.client;
    }
}