import { createServer } from 'node:http';

import { describe, expect, it } from 'vitest';

import { EnvironmentConfig } from '../../src/config/environment.js';
import { ServerApplication } from '../../src/app.js';
import { requestJson } from '../fixtures/http-client.js';

const startTestServer = async () => {
    const environment = new EnvironmentConfig({
        PORT: '0',
        AUTH_SECRET: 'integration-secret',
        ENABLE_SWAGGER_DOCS: 'false',
        ENABLE_SUBDOMAIN_ROUTING: 'true',
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

describe('Tenant routing integration', () => {
    it('returns tenant-aware config for host-based requests and keeps auth functional', async () => {
        const server = await startTestServer();
        const hostHeader = 'tenant-one.example.test';

        try {
            const configResponse = await requestJson(`${server.baseUrl}/config`, {
                headers: {
                    host: hostHeader,
                },
            });

            expect(configResponse.statusCode).toBe(200);
            expect(configResponse.body).toEqual({
                apiBaseUrl: `http://${hostHeader}`,
                tenantSlug: 'tenant-one',
                hostname: hostHeader,
            });

            const registerResponse = await requestJson(`${server.baseUrl}/auth/register`, {
                method: 'POST',
                headers: {
                    host: hostHeader,
                },
                body: {
                    identifier: 'tenant-user@example.com',
                    password: 'Secret123!',
                    role: 'Tenant Admin',
                },
            });

            expect(registerResponse.statusCode).toBe(201);

            const loginResponse = await requestJson(`${server.baseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    host: hostHeader,
                },
                body: {
                    identifier: 'tenant-user@example.com',
                    password: 'Secret123!',
                },
            });

            expect(loginResponse.statusCode).toBe(200);
            expect((loginResponse.body as { accessToken?: string }).accessToken).toBeTruthy();
        } finally {
            await server.close();
        }
    });

    it('falls back to normal routing when subdomain routing is disabled', async () => {
        const environment = new EnvironmentConfig({
            PORT: '0',
            AUTH_SECRET: 'integration-secret',
            ENABLE_SWAGGER_DOCS: 'false',
            ENABLE_SUBDOMAIN_ROUTING: 'false',
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

        try {
            const configResponse = await requestJson(`http://127.0.0.1:${address.port}/config`, {
                headers: {
                    host: 'localhost:3000',
                },
            });

            expect(configResponse.statusCode).toBe(200);
            expect(configResponse.body).toEqual({
                apiBaseUrl: 'http://localhost:3000',
                tenantSlug: null,
                hostname: 'localhost',
            });
        } finally {
            await new Promise<void>((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
            });
        }
    });
});