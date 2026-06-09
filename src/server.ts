import 'dotenv/config';

import { GlitchTipService } from './infrastructure/monitoring/glitchtip.service.js';
GlitchTipService.init();

import { ServerApplication } from './app.js';
import { EnvironmentConfig } from './config/environment.js';
import { DatabaseConnection } from './infrastructure/database/database-connection.js';
import { MinioStorageService } from './infrastructure/storage/minio-storage.js';
import { RedisConnection } from './infrastructure/redis/redis-connection.js';
import type { DependencyHealthProvider } from './app.js';
import type { Express } from 'express';
import type { Server as HttpServer } from 'node:http';

class ServerBootstrap {
    private httpServer: HttpServer | null = null;

    public constructor(
        private readonly application: Express,
        private readonly port: number,
        private readonly enableSwaggerDocs: boolean,
        private readonly databaseConnection: DatabaseConnection,
        private readonly redisConnection: RedisConnection,
        private readonly storageService: MinioStorageService,
    ) { }

    public async start(): Promise<void> {
        await Promise.all([
            this.databaseConnection.connect(),
            this.redisConnection.connect(),
            this.storageService.connect(),
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

            try {
                const { bootstrapSuperAdmin } = await import('./modules/Auth/infrastructure/SuperAdminBootstrap.js');
                await bootstrapSuperAdmin(prisma as any);
            } catch (error) {
                console.error('Super Admin bootstrap failed:', error instanceof Error ? error.message : String(error));
                throw error;
            }
        }

        this.httpServer = this.application.listen(this.port, () => {
            console.log(`Server running on http://localhost:${this.port}`);

            if (this.enableSwaggerDocs) {
                console.log(`Swagger docs available at http://localhost:${this.port}/docs`);
            } else {
                console.log('Swagger docs are disabled. Set ENABLE_SWAGGER_DOCS=true to enable /docs and /openapi.json.');
            }
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
        if (this.application.locals.cronScheduler) {
            this.application.locals.cronScheduler.stopAll();
        }

        if (this.application.locals.smsRetryWorker) {
            this.application.locals.smsRetryWorker.stop();
        }

        if (this.application.locals.emailRetryWorker) {
            this.application.locals.emailRetryWorker.stop();
        }

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
            this.storageService.disconnect(),
        ]);
    }
}

const environment = EnvironmentConfig.fromProcessEnv();
const databaseConnection = new DatabaseConnection(environment.databaseUrl);
const redisConnection = new RedisConnection(environment.redisUrl);
const storageService = new MinioStorageService(environment);

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

const appInstance = new ServerApplication(environment, databaseConnection.getClient(), redisConnection);

appInstance.getApp().locals.dependencyHealthProvider = dependencyHealthProvider;
appInstance.getApp().locals.storageService = storageService;

const server = new ServerBootstrap(appInstance.getApp(), environment.port, environment.enableSwaggerDocs, databaseConnection, redisConnection, storageService);

server.start().catch((error: unknown) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
