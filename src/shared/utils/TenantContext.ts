/**
 * @file TenantContext.ts
 * @layer LOGIC — Context management for request-scoped multi-tenancy.
 *
 * ╔═══ AGENT / DEVELOPER RULES ═══╗
 * * **✅ DO** use `tenantContext.getTenantId()` to fetch the active request's tenant slug/ID.
 * * **✅ DO** ensure asynchronous callbacks retain context or run inside the storage boundary if spawned outside the request loop.
 * * **❌ DO NOT** manually override or mock `tenantContext` in application handlers.
 * * **⚠️ Context Availability**: `tenantContext.getTenantId()` returns `undefined` when executed outside
 *   of an Express web request (such as startup scripts, database seeders, or background cron jobs).
 *   Your code MUST handle this case gracefully.
 * ╚═════════════════════════════════╝
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response, NextFunction } from 'express';
import { resolveTenantSlug } from './tenantResolver.js';

class TenantContext {
    private readonly storage = new AsyncLocalStorage<string>();

    /**
     * Run a function within a specific tenant context.
     * @param tenantId The current tenant identifier (slug or UUID)
     * @param fn The callback function to run within context
     */
    public run<T>(tenantId: string, fn: () => T): T {
        return this.storage.run(tenantId, fn);
    }

    /**
     * Get the current tenant ID in the active context.
     * Returns undefined if called outside of a tenant-scoped request context.
     */
    public getTenantId(): string | undefined {
        return this.storage.getStore();
    }
}

export const tenantContext = new TenantContext();

/**
 * Express middleware that extracts the tenant slug/ID from request headers
 * and scopes subsequent request execution inside a TenantContext AsyncLocalStorage.
 */
export const tenantContextMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const tenantId = resolveTenantSlug(req.headers);
    if (tenantId) {
        tenantContext.run(tenantId, () => {
            next();
        });
    } else {
        next();
    }
};
