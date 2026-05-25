import app from '../src/app.js';
import { EnvironmentConfig } from '../src/config/environment.js';
import { DatabaseConnection } from '../src/infrastructure/database/database-connection.js';
import { RedisConnection } from '../src/infrastructure/redis/redis-connection.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

const environment = EnvironmentConfig.fromProcessEnv();
const databaseConnection = new DatabaseConnection(environment.databaseUrl);
const redisConnection = new RedisConnection(environment.redisUrl);

const bootstrapPromise = Promise.all([
	databaseConnection.connect(),
	redisConnection.connect(),
]).then(() => {
	console.log('Vercel function bootstrap complete');
});

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
	await bootstrapPromise;
	app(request, response);
}
