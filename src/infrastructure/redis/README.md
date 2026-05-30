# Redis Infrastructure

This folder contains the Redis connection layer used for caching, background coordination, and any future rate-limit or session-style workloads.

## What it does

- Normalizes Redis and Rediss URLs.
- Creates a shared Redis client from `REDIS_URL`.
- Exposes connect, disconnect, client access, and health-check operations.

## Main entry point

- `RedisConnection` in `redis-connection.ts`

## How application code uses it

The Redis client is created during server bootstrap and reused by modules that need it.

Example:

```ts
import { EnvironmentConfig } from '../../config/environment.js';
import { RedisConnection } from '../infrastructure/redis/redis-connection.js';

const environment = EnvironmentConfig.fromProcessEnv();
const redisConnection = new RedisConnection(environment.redisUrl);

await redisConnection.connect();
const redis = redisConnection.getClient();
```

If `REDIS_URL` is missing or invalid, the Redis client is not created and the server continues without Redis-backed features.

## When to use it

Use this infrastructure when you need:

- caching
- queue-like coordination
- distributed locks or counters
- shared Redis access from application services
- readiness checks for Redis in `/health`

## Environment variables

- `REDIS_URL`

## Notes for the team

- Prefer a single shared Redis client from bootstrap.
- Keep Redis usage behind application services instead of calling it directly from controllers.
- Use `getHealthStatus()` for monitoring and health endpoints.
