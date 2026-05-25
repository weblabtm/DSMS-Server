import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';

export class DatabaseConnection {
    private readonly client: PrismaClient | null;

    private isConnected = false;

    private lastError: string | null = null;

    public constructor(private readonly databaseUrl: string) {
        if (!databaseUrl) {
            this.client = null;
            this.lastError = 'DATABASE_URL is missing.';
            console.error('Database disabled: DATABASE_URL is missing.');
            return;
        }

        try {
            const parsedUrl = new URL(databaseUrl);
            const protocol = parsedUrl.protocol;

            if (protocol !== 'postgres:' && protocol !== 'postgresql:') {
                this.client = null;
                this.lastError = 'DATABASE_URL has an invalid protocol.';
                console.error('Database disabled: DATABASE_URL has an invalid protocol.');
                return;
            }

            const adapter = new PrismaPg({ connectionString: databaseUrl });
            this.client = new PrismaClient({ adapter });
        } catch (error) {
            this.client = null;
            this.lastError = error instanceof Error ? error.message : String(error);
            console.error('Database disabled: DATABASE_URL is invalid.', error);
        }
    }

    public async connect(): Promise<void> {
        if (!this.client) {
            return;
        }

        try {
            await this.client.$connect();
            this.isConnected = true;
            this.lastError = null;
        } catch (error) {
            this.isConnected = false;
            this.lastError = error instanceof Error ? error.message : String(error);
            console.error('Database connection failed. Continuing without database.', error);
            return;
        }

        console.log('Database connected');
    }

    public async disconnect(): Promise<void> {
        if (!this.client) {
            return;
        }

        await this.client.$disconnect();
        this.isConnected = false;
    }

    public getClient(): PrismaClient | null {
        return this.client;
    }

    public async getHealthStatus(): Promise<{ connected: boolean; error?: string }> {
        if (!this.client) {
            return {
                connected: false,
                error: this.lastError ?? 'Database client is not configured.',
            };
        }

        try {
            await this.client.$queryRawUnsafe('SELECT 1');
            this.isConnected = true;
            this.lastError = null;
            return { connected: true };
        } catch (error) {
            this.isConnected = false;
            this.lastError = error instanceof Error ? error.message : String(error);
            return {
                connected: false,
                error: this.lastError,
            };
        }
    }
}