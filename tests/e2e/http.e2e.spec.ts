import { createServer } from 'node:http';

import { describe, expect, it } from 'vitest';

import { EnvironmentConfig } from '../../src/config/environment.js';
import { ServerApplication } from '../../src/app.js';
import { DatabaseConnection } from '../../src/infrastructure/database/database-connection.js';
import { RedisConnection } from '../../src/infrastructure/redis/redis-connection.js';
import { createTenantHttpFixtures } from '../fixtures/http-fixtures.js';
import { requestJson } from '../fixtures/http-client.js';

const startTestServer = async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is required for e2e endpoint flow tests.');
    }

    const databaseConnection = new DatabaseConnection(databaseUrl);
    await databaseConnection.connect();

    const prisma = databaseConnection.getClient();
    if (!prisma) {
        throw new Error('Prisma client is not available for e2e endpoint flow tests.');
    }

    const environment = new EnvironmentConfig({
        PORT: '0',
        AUTH_SECRET: 'e2e-secret',
        ENABLE_SWAGGER_DOCS: 'false',
        DATABASE_URL: databaseUrl,
        REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
        ENABLE_SUPER_ADMIN_BOOTSTRAP: 'false',
    } as NodeJS.ProcessEnv);

    const redisConnection = new RedisConnection(environment.redisUrl);
    await redisConnection.connect();

    const application = new ServerApplication(environment, prisma as never, redisConnection);
    const app = application.getApp();
    const server = createServer(app);

    await new Promise<void>((resolve) => {
        server.listen(0, resolve);
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Unable to determine test server port');
    }

    return {
        baseUrl: `http://127.0.0.1:${address.port}`,
        prisma,
        close: async () => {
            await new Promise<void>((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
            });

            await redisConnection.disconnect();
            await databaseConnection.disconnect();
        },
    };
};

describe('HTTP e2e smoke tests', () => {
    it('runs full auth+tenant endpoint flow and cleans DB data even on failure', async () => {
        const server = await startTestServer();
        const suffix = `e2e-${Date.now()}`;
        const fixtures = createTenantHttpFixtures(suffix);
        const hostHeader = `tenant-${suffix}.example.test`;
        const createdIdentifiers: string[] = [fixtures.tenantAdmin.identifier];
        const createdTenantIds: string[] = [];
        let flowError: Error | undefined;
        let step = 'start';

        try {
            step = 'GET /health';
            const healthResponse = await requestJson(`${server.baseUrl}/health`, {
                headers: {
                    host: hostHeader,
                },
            });
            expect(healthResponse.statusCode).toBe(200);

            step = 'GET /config';
            const configResponse = await requestJson(`${server.baseUrl}/config`, {
                headers: {
                    host: hostHeader,
                },
            });
            expect(configResponse.statusCode).toBe(200);
            expect(configResponse.body).toEqual({
                apiBaseUrl: `http://${hostHeader}`,
                hostname: `${hostHeader}`,
            });

            step = 'POST /auth/register (Tenant Admin self-registration)';
            const registerResponse = await requestJson(`${server.baseUrl}/auth/register`, {
                method: 'POST',
                headers: {
                    host: hostHeader,
                },
                body: {
                    identifier: fixtures.tenantAdmin.identifier,
                    password: fixtures.tenantAdmin.password,
                    role: 'Tenant Admin',
                },
            });

            expect(registerResponse.statusCode).toBe(201);
            const registerSession = registerResponse.body as Record<string, unknown>;
            expect(registerSession.accessToken).toBeTruthy();
            expect(registerSession.refreshToken).toBeTruthy();
            expect(registerSession.sessionId).toBeTruthy();

            step = 'POST /auth/login';
            const loginResponse = await requestJson(`${server.baseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    host: hostHeader,
                },
                body: {
                    identifier: fixtures.tenantAdmin.identifier,
                    password: fixtures.tenantAdmin.password,
                },
            });

            expect(loginResponse.statusCode).toBe(200);
            const loginSession = loginResponse.body as Record<string, unknown>;
            expect(loginSession.accessToken).toBeTruthy();
            expect(loginSession.refreshToken).toBeTruthy();

            step = 'POST /auth/refresh';
            const refreshResponse = await requestJson(`${server.baseUrl}/auth/refresh`, {
                method: 'POST',
                headers: {
                    host: hostHeader,
                },
                body: {
                    refreshToken: loginSession.refreshToken,
                },
            });

            expect(refreshResponse.statusCode).toBe(200);
            const refreshedSession = refreshResponse.body as Record<string, unknown>;
            expect(refreshedSession.accessToken).toBeTruthy();
            expect(refreshedSession.refreshToken).toBeTruthy();

            step = 'POST /tenant';
            const tenantResponse = await requestJson(`${server.baseUrl}/tenant`, {
                method: 'POST',
                headers: {
                    host: hostHeader,
                    authorization: `Bearer ${loginSession.accessToken}`,
                },
                body: fixtures.createTenant,
            });

            expect(tenantResponse.statusCode).toBe(201);

            const createdTenant = tenantResponse.body as Record<string, unknown>;
            createdTenantIds.push(String(createdTenant.id));
            expect(createdTenant.name).toBe(fixtures.createTenant.name);
            expect(createdTenant.isActive).toBe(true);

            // After POST /tenant the DB session is updated with the tenant's slug as tenantId.
            // Refresh the token so the new access token carries the tenantId claim — required
            // for scope-based authorization checks in GET/PATCH /tenant/:id.
            step = 'POST /auth/refresh (post-tenant, to pick up tenantId in claims)';
            const postTenantRefreshResponse = await requestJson(`${server.baseUrl}/auth/refresh`, {
                method: 'POST',
                headers: { host: hostHeader },
                body: { refreshToken: refreshedSession.refreshToken },
            });
            expect(postTenantRefreshResponse.statusCode).toBe(200);
            const postTenantSession = postTenantRefreshResponse.body as Record<string, unknown>;
            expect(postTenantSession.accessToken).toBeTruthy();
            const tenantScopedToken = String(postTenantSession.accessToken);
            const postTenantRefreshToken = String(postTenantSession.refreshToken);

            step = 'GET /tenant (expect 403 — Tenant Admin cannot list all tenants)';
            const listResponse = await requestJson(`${server.baseUrl}/tenant`, {
                headers: {
                    host: hostHeader,
                    authorization: `Bearer ${tenantScopedToken}`,
                },
            });
            // Tenant Admin cannot list all tenants — only Super Admin can (authorization guard verified).
            expect(listResponse.statusCode).toBe(403);

            step = 'GET /tenant/{id}';
            const getTenantResponse = await requestJson(`${server.baseUrl}/tenant/${createdTenant.id}`, {
                headers: {
                    host: hostHeader,
                    authorization: `Bearer ${tenantScopedToken}`,
                },
            });
            expect(getTenantResponse.statusCode).toBe(200);
            const getTenant = getTenantResponse.body as Record<string, unknown>;
            expect(getTenant.id).toBe(createdTenant.id);

            step = 'PATCH /tenant/{id}';
            const patchResponse = await requestJson(`${server.baseUrl}/tenant/${createdTenant.id}`, {
                method: 'PATCH',
                headers: {
                    host: hostHeader,
                    authorization: `Bearer ${tenantScopedToken}`,
                },
                body: {
                    name: `${fixtures.createTenant.name}-updated`,
                    isActive: false,
                },
            });
            expect(patchResponse.statusCode).toBe(200);
            const patchedTenant = patchResponse.body as Record<string, unknown>;
            expect(patchedTenant.name).toBe(`${fixtures.createTenant.name}-updated`);
            expect(patchedTenant.isActive).toBe(false);


            step = 'POST /auth/logout';
            const logoutResponse = await requestJson(`${server.baseUrl}/auth/logout`, {
                method: 'POST',
                headers: {
                    host: hostHeader,
                },
                body: {
                    // Use the most recent refresh token; prior ones are consumed by rotation.
                    refreshToken: postTenantRefreshToken,
                },
            });
            expect(logoutResponse.statusCode).toBe(204);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            flowError = new Error(`Endpoint flow failed at step "${step}": ${message}`);
        } finally {
            let cleanupError: Error | undefined;

            try {
                const users = await (server.prisma as any).authUser.findMany({
                    where: { identifier: { in: createdIdentifiers } },
                    select: { id: true },
                });

                const userIds = users.map((user: any) => String(user.id));

                if (userIds.length > 0) {
                    await (server.prisma as any).authSession.deleteMany({
                        where: { userId: { in: userIds } },
                    });
                }

                if (createdTenantIds.length > 0) {
                    await (server.prisma as any).tenant.deleteMany({
                        where: { id: { in: createdTenantIds } },
                    });
                }

                await (server.prisma as any).authUser.deleteMany({
                    where: { identifier: { in: createdIdentifiers } },
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                cleanupError = new Error(`Cleanup failed after step "${step}": ${message}`);
            }

            await server.close();

            if (flowError && cleanupError) {
                throw new Error(`${flowError.message}. ${cleanupError.message}`);
            }

            if (flowError) {
                throw flowError;
            }

            if (cleanupError) {
                throw cleanupError;
            }
        }
    });
});
