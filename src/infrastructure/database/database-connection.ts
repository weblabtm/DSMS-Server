import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';

export class DatabaseConnection {
    private readonly client: PrismaClient;

    public constructor(private readonly databaseUrl: string) {
        if (!databaseUrl) {
            throw new Error('DATABASE_URL is required to start the server.');
        }

        const adapter = new PrismaPg({ connectionString: databaseUrl });

        this.client = new PrismaClient({ adapter });
    }

    public async connect(): Promise<void> {
        await this.client.$connect();

        console.log('Database connected');
    }

    public async disconnect(): Promise<void> {
        await this.client.$disconnect();
    }

    public getClient(): PrismaClient {
        return this.client;
    }
}