import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';

export class DatabaseConnection {
    private readonly client: PrismaClient | null;

    public constructor(private readonly databaseUrl: string) {
        if (!databaseUrl) {
            this.client = null;
            console.error('Database disabled: DATABASE_URL is missing.');
            return;
        }

        try {
            const parsedUrl = new URL(databaseUrl);
            const protocol = parsedUrl.protocol;

            if (protocol !== 'postgres:' && protocol !== 'postgresql:') {
                this.client = null;
                console.error('Database disabled: DATABASE_URL has an invalid protocol.');
                return;
            }

            const adapter = new PrismaPg({ connectionString: databaseUrl });
            this.client = new PrismaClient({ adapter });
        } catch (error) {
            this.client = null;
            console.error('Database disabled: DATABASE_URL is invalid.', error);
        }
    }

    public async connect(): Promise<void> {
        if (!this.client) {
            return;
        }

        try {
            await this.client.$connect();
        } catch (error) {
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
    }

    public getClient(): PrismaClient | null {
        return this.client;
    }
}