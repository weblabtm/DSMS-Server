import { ServerApplication } from '../src/app.js';
import { EnvironmentConfig } from '../src/config/environment.js';
import { DatabaseConnection } from '../src/infrastructure/database/database-connection.js';
import { RedisConnection } from '../src/infrastructure/redis/redis-connection.js';
import type { DependencyHealthProvider } from '../src/app.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

const environment = EnvironmentConfig.fromProcessEnv();
const databaseConnection = new DatabaseConnection(environment.databaseUrl);
const redisConnection = new RedisConnection(environment.redisUrl);
const app = new ServerApplication(environment, databaseConnection.getClient()).getApp();

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

app.locals.dependencyHealthProvider = dependencyHealthProvider;

const bootstrapPromise = Promise.allSettled([
    databaseConnection.connect(),
    redisConnection.connect(),
]).then((results) => {
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            const serviceName = index === 0 ? 'database' : 'redis';
            console.error(`Vercel bootstrap ${serviceName} rejected`, result.reason);
        }
    });

    console.log('Vercel function bootstrap complete');
});

void bootstrapPromise;

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
        app(request, response);
    } catch (error) {
        console.error('Vercel handler failed', error);
        response.statusCode = 500;
        response.end('Internal Server Error');
    }
}
