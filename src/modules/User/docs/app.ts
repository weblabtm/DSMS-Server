import express, { type Express, type NextFunction, type Request, type Response } from 'express';

import { EnvironmentConfig } from './config/environment.js';
import { AuthController } from './modules/Auth/presentation/controllers/AuthController.js';
import { AuthService } from './modules/Auth/application/services/AuthService.js';
import { SessionService } from './modules/Auth/application/services/SessionService.js';
import { PrismaSessionService } from './modules/Auth/infrastructure/PrismaSessionService.js';
import { TokenService } from './modules/Auth/application/services/TokenService.js';
import { InMemoryAuthDao } from './modules/Auth/infrastructure/InMemoryAuthDao.js';
import { PrismaAuthDao } from './modules/Auth/infrastructure/PrismaAuthDao.js';
import { createAuthRouter } from './modules/Auth/presentation/routes/authRoutes.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { registerSwaggerDocs } from './docs/swagger.js';

type ServiceHealth = {
    status: 'connected' | 'disconnected';
    error?: string;
};

type DependencyHealth = {
    postgresql: ServiceHealth;
    redis: ServiceHealth;
};

export type DependencyHealthProvider = () => Promise<DependencyHealth>;

export class ServerApplication {
    private readonly app: Express;

    private readonly allowedOrigins: Set<string>;

    private readonly authController: AuthController;

    public constructor(private readonly environment: EnvironmentConfig, prismaClient?: PrismaClient | null) {
        this.app = express();
        this.allowedOrigins = new Set(environment.allowedOrigins);

        const authDao = prismaClient ? new PrismaAuthDao(prismaClient) : new InMemoryAuthDao();
        const tokenService = new TokenService(environment.authSecret ?? 'dev-secret');
        const sessionService = prismaClient ? new PrismaSessionService(prismaClient) : new SessionService();
        const authService = new AuthService({ tokenService, sessionService, authDao });
        this.authController = new AuthController(authService);

        this.registerMiddleware();
        this.registerRoutes();
        this.registerDocumentation();
        this.registerNotFoundHandler();
    }

    public getApp(): Express {
        return this.app;
    }

    private registerMiddleware(): void {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(this.createCorsMiddleware());
    }

    private registerRoutes(): void {
        this.app.get('/health', this.healthCheckHandler);

        const authRouter = createAuthRouter(this.authController);
        this.app.use('/auth', authRouter);
    }

    private registerDocumentation(): void {
        if (!this.environment.enableSwaggerDocs) {
            return;
        }

        registerSwaggerDocs(this.app);
    }

    private registerNotFoundHandler(): void {
        this.app.use(this.notFoundHandler);
    }

    private createCorsMiddleware() {
        return (request: Request, response: Response, next: NextFunction) => {
            const origin = request.headers.origin;

            if (typeof origin === 'string' && (this.allowedOrigins.has('*') || this.allowedOrigins.has(origin))) {
                response.setHeader('Access-Control-Allow-Origin', origin);
                response.setHeader('Vary', 'Origin');
            }

            response.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
            response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

            if (request.method === 'OPTIONS') {
                response.sendStatus(204);
                return;
            }

            next();
        };
    }

    private async healthCheckHandler(request: Request, response: Response): Promise<void> {
        const provider = request.app.locals.dependencyHealthProvider as DependencyHealthProvider | undefined;

        if (!provider) {
            response.status(200).json({
                status: 'ok',
                message: 'Server is running',
            });
            return;
        }

        try {
            const dependencies = await provider();
            const hasError = dependencies.postgresql.status !== 'connected' || dependencies.redis.status !== 'connected';

            response.status(hasError ? 503 : 200).json({
                status: hasError ? 'error' : 'ok',
                message: hasError ? 'One or more dependencies are unavailable' : 'Server is running',
                dependencies,
            });
        } catch (error) {
            response.status(503).json({
                status: 'error',
                message: 'Unable to determine dependency status',
                dependencies: {
                    postgresql: {
                        status: 'disconnected',
                        error: 'Health check failed',
                    },
                    redis: {
                        status: 'disconnected',
                        error: 'Health check failed',
                    },
                },
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private notFoundHandler(_request: Request, response: Response): void {
        response.status(404).json({
            message: 'Route not found',
        });
    }
}
