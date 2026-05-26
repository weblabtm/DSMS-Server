import 'dotenv/config';

import { ServerApplication } from './app.js';
import { EnvironmentConfig } from './config/environment.js';
import { DatabaseConnection } from './infrastructure/database/database-connection.js';
import { RedisConnection } from './infrastructure/redis/redis-connection.js';
import type { DependencyHealthProvider } from './app.js';
import type { Express } from 'express';
import type { Server as HttpServer } from 'node:http';

class ServerBootstrap {
    private httpServer: HttpServer | null = null;

    public constructor(
        private readonly application: Express,
        private readonly port: number,
        private readonly databaseConnection: DatabaseConnection,
        private readonly redisConnection: RedisConnection,
    ) { }

    public async start(): Promise<void> {
        await Promise.all([
            this.databaseConnection.connect(),
            this.redisConnection.connect(),
        ]);

        // Seed RBAC matrix if database is available
        const prisma = this.databaseConnection.getClient();
        if (prisma) {
            try {
                const { PrismaRoleMatrixSeeder } = await import('./modules/Auth/infrastructure/PrismaRoleMatrixSeeder.js');
                const seeder = new PrismaRoleMatrixSeeder(prisma as any);
                await seeder.seed();
                console.log('RBAC role matrix seeded');
            } catch (error) {
                console.error('RBAC seeding failed:', error instanceof Error ? error.message : String(error));
            }
        }

        this.httpServer = this.application.listen(this.port, () => {
            console.log(`Server running on http://localhost:${this.port}`);
        });

        this.registerShutdownHooks();
    }

    private registerShutdownHooks(): void {
        const shutdown = async () => {
            await this.stop();
            process.exit(0);
        };

        process.once('SIGINT', shutdown);
        process.once('SIGTERM', shutdown);
    }

    private async stop(): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            if (!this.httpServer) {
                resolve();
                return;
            }

            this.httpServer.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });

        await Promise.all([
            this.redisConnection.disconnect(),
            this.databaseConnection.disconnect(),
        ]);
    }
}

const environment = EnvironmentConfig.fromProcessEnv();
const databaseConnection = new DatabaseConnection(environment.databaseUrl);
const redisConnection = new RedisConnection(environment.redisUrl);

const dependencyHealthProvider: DependencyHealthProvider = async () => {
    const [databaseStatus, redisStatus] = await Promise.all([
        databaseConnection.getHealthStatus(),
        redisConnection.getHealthStatus(),
    ]);

    return {
        postgresql: {
            status: databaseStatus.connected ? 'connected' : 'disconnected',
            ...(databaseStatus.error ? { error: databaseStatus.error } : {}),
        },
        redis: {
            status: redisStatus.connected ? 'connected' : 'disconnected',
            ...(redisStatus.error ? { error: redisStatus.error } : {}),
        },
    };
};

const appInstance = new ServerApplication(environment, databaseConnection.getClient());

appInstance.getApp().locals.dependencyHealthProvider = dependencyHealthProvider;

const server = new ServerBootstrap(appInstance.getApp(), environment.port, databaseConnection, redisConnection);

server.start().catch((error: unknown) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
