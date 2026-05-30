import { createServer } from 'node:http';

import { describe, expect, it } from 'vitest';

import { EnvironmentConfig } from '../../src/config/environment.js';
import { ServerApplication } from '../../src/app.js';
import { DatabaseConnection } from '../../src/infrastructure/database/database-connection.js';
import { createTenantHttpFixtures } from '../fixtures/http-fixtures.js';

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

    const application = new ServerApplication(environment, prisma as never);
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

            await databaseConnection.disconnect();
        },
    };
};

describe('HTTP e2e smoke tests', () => {
    it('runs full auth+tenant endpoint flow and cleans DB data even on failure', async () => {
        const server = await startTestServer();
        const suffix = `e2e-${Date.now()}`;
        const fixtures = createTenantHttpFixtures(suffix);
        const createdIdentifiers: string[] = [fixtures.tenantAdmin.identifier];
        const createdTenantIds: string[] = [];
        let flowError: Error | undefined;
        let step = 'start';

        try {
            step = 'GET /health';
            const healthResponse = await fetch(`${server.baseUrl}/health`);
            expect(healthResponse.status).toBe(200);

            step = 'POST /auth/register (Tenant Admin self-registration)';
            const registerResponse = await fetch(`${server.baseUrl}/auth/register`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    identifier: fixtures.tenantAdmin.identifier,
                    password: fixtures.tenantAdmin.password,
                    role: 'Tenant Admin',
                }),
            });

            expect(registerResponse.status).toBe(201);
            const registerSession = await registerResponse.json();
            expect(registerSession.accessToken).toBeTruthy();
            expect(registerSession.refreshToken).toBeTruthy();
            expect(registerSession.sessionId).toBeTruthy();

            step = 'POST /auth/login';
            const loginResponse = await fetch(`${server.baseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    identifier: fixtures.tenantAdmin.identifier,
                    password: fixtures.tenantAdmin.password,
                }),
            });

            expect(loginResponse.status).toBe(200);
            const loginSession = await loginResponse.json();
            expect(loginSession.accessToken).toBeTruthy();
            expect(loginSession.refreshToken).toBeTruthy();

            step = 'POST /auth/refresh';
            const refreshResponse = await fetch(`${server.baseUrl}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    refreshToken: loginSession.refreshToken,
                }),
            });

            expect(refreshResponse.status).toBe(200);
            const refreshedSession = await refreshResponse.json();
            expect(refreshedSession.accessToken).toBeTruthy();
            expect(refreshedSession.refreshToken).toBeTruthy();

            step = 'POST /tenant';
            const tenantResponse = await fetch(`${server.baseUrl}/tenant`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${loginSession.accessToken}`,
                },
                body: JSON.stringify(fixtures.createTenant),
            });

            expect(tenantResponse.status).toBe(201);

            const createdTenant = await tenantResponse.json();
            createdTenantIds.push(String(createdTenant.id));
            expect(createdTenant.name).toBe(fixtures.createTenant.name);
            expect(createdTenant.isActive).toBe(true);

            step = 'GET /tenant';
            const listResponse = await fetch(`${server.baseUrl}/tenant`, {
                method: 'GET',
                headers: {
                    authorization: `Bearer ${loginSession.accessToken}`,
                },
            });
            expect(listResponse.status).toBe(200);
            const tenantList = await listResponse.json();
            expect(Array.isArray(tenantList)).toBe(true);
            expect(tenantList.some((item: any) => item.id === createdTenant.id)).toBe(true);

            step = 'GET /tenant/{id}';
            const getTenantResponse = await fetch(`${server.baseUrl}/tenant/${createdTenant.id}`, {
                method: 'GET',
                headers: {
                    authorization: `Bearer ${loginSession.accessToken}`,
                },
            });
            expect(getTenantResponse.status).toBe(200);
            const getTenant = await getTenantResponse.json();
            expect(getTenant.id).toBe(createdTenant.id);

            step = 'PATCH /tenant/{id}';
            const patchResponse = await fetch(`${server.baseUrl}/tenant/${createdTenant.id}`, {
                method: 'PATCH',
                headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${loginSession.accessToken}`,
                },
                body: JSON.stringify({
                    name: `${fixtures.createTenant.name}-updated`,
                    isActive: false,
                }),
            });
            expect(patchResponse.status).toBe(200);
            const patchedTenant = await patchResponse.json();
            expect(patchedTenant.name).toBe(`${fixtures.createTenant.name}-updated`);
            expect(patchedTenant.isActive).toBe(false);

            step = 'POST /auth/logout';
            const logoutResponse = await fetch(`${server.baseUrl}/auth/logout`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    refreshToken: refreshedSession.refreshToken,
                }),
            });
            expect(logoutResponse.status).toBe(204);
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
