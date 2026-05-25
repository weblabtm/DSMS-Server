import express, { type Express, type NextFunction, type Request, type Response } from 'express';

import { EnvironmentConfig } from './config/environment.js';

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

    public constructor(private readonly environment: EnvironmentConfig) {
        this.app = express();
        this.allowedOrigins = new Set(environment.allowedOrigins);

        this.registerMiddleware();
        this.registerRoutes();
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

    private async healthCheckHandler(_request: Request, response: Response): Promise<void> {
        const provider = this.app.locals.dependencyHealthProvider as DependencyHealthProvider | undefined;

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

const serverApplication = new ServerApplication(EnvironmentConfig.fromProcessEnv());

export default serverApplication.getApp();
