import { describe, expect, it, vi } from 'vitest';

import { TenantRoutingMiddleware } from '../../../../src/modules/Tenant/presentation/middleware/TenantRoutingMiddleware.js';

describe('TenantRoutingMiddleware', () => {
    it('derives tenant context from a tenant subdomain', () => {
        const middleware = new TenantRoutingMiddleware();
        const request = {
            headers: {
                host: 'acme.example.com:3000',
                'x-forwarded-proto': 'https',
            },
            protocol: 'http',
            hostname: 'acme.example.com',
        };
        const response = {};
        const next = vi.fn();

        middleware.handle(request as never, response as never, next);

        expect(next).toHaveBeenCalledOnce();
        expect((request as { tenantContext?: { host: string; hostname: string; tenantSlug?: string; apiBaseUrl: string } }).tenantContext).toEqual({
            host: 'acme.example.com:3000',
            hostname: 'acme.example.com',
            tenantSlug: 'acme',
            apiBaseUrl: 'https://acme.example.com:3000',
        });
    });

    it('ignores reserved hosts like api and localhost', () => {
        const middleware = new TenantRoutingMiddleware();
        const request = {
            headers: {
                host: 'api.example.com',
            },
            protocol: 'http',
            hostname: 'api.example.com',
        };
        const response = {};
        const next = vi.fn();

        middleware.handle(request as never, response as never, next);

        expect((request as { tenantContext?: { tenantSlug?: string } }).tenantContext?.tenantSlug).toBeUndefined();
    });
});