import { createServer } from 'node:http';

import { describe, expect, it } from 'vitest';

import { EnvironmentConfig } from '../../src/config/environment.js';
import { ServerApplication } from '../../src/app.js';
import { createAuthHttpFixtures, createBearerToken, createTenantHttpFixtures } from '../fixtures/http-fixtures.js';

const startTestServer = async () => {
    const environment = new EnvironmentConfig({
        PORT: '0',
        AUTH_SECRET: 'e2e-secret',
        ENABLE_SWAGGER_DOCS: 'false',
    } as NodeJS.ProcessEnv);

    const application = new ServerApplication(environment);
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
        close: async () => {
            await new Promise<void>((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
            });
        },
    };
};

describe('HTTP e2e smoke tests', () => {
    it('serves health, auth registration, and tenant creation flows', async () => {
        const server = await startTestServer();
        const authFixtures = createAuthHttpFixtures('e2e');
        const tenantFixtures = createTenantHttpFixtures('e2e');
        const inviterToken = createBearerToken('e2e-secret', {
            subject: authFixtures.inviter.subject,
            roles: authFixtures.inviter.roles,
            tenantId: authFixtures.inviter.tenantId,
            branchId: authFixtures.inviter.branchId,
        });
        const superAdminToken = createBearerToken('e2e-secret', {
            subject: 'super-admin-e2e',
            roles: ['Super Admin'],
        });

        try {
            const healthResponse = await fetch(`${server.baseUrl}/health`);
            expect(healthResponse.status).toBe(200);

            const registerResponse = await fetch(`${server.baseUrl}/auth/register`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${inviterToken}`,
                },
                body: JSON.stringify(authFixtures.registration),
            });

            expect(registerResponse.status).toBe(201);

            const tenantResponse = await fetch(`${server.baseUrl}/tenant`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${superAdminToken}`,
                },
                body: JSON.stringify(tenantFixtures.createTenant),
            });

            expect(tenantResponse.status).toBe(201);

            const createdTenant = await tenantResponse.json();
            expect(createdTenant.name).toBe(tenantFixtures.createTenant.name);
            expect(createdTenant.isActive).toBe(true);
        } finally {
            await server.close();
        }
    });
});
