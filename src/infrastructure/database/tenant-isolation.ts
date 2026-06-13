/**
 * @file tenant-isolation.ts
 * @layer DATABASE — Automatic multi-tenant Prisma Client query extension.
 *
 * ╔═══ AGENT / DEVELOPER RULES ═══╗
 * * **❌ DO NOT bypass the ORM layer**: Never use raw database queries (`$queryRaw`, `$queryRawUnsafe`, `$executeRaw`, `$executeRawUnsafe`). They bypass this extension and will lead to tenant isolation leaks.
 * * **✅ DO rely on automatic scoping**: You do not need to manually append `{ where: { tenantId } }` for every model query inside Express request handlers; this query extension automatically injects the active tenant context.
 * * **✅ DO use standard Prisma methods**: Use standard Prisma queries (`findFirst`, `findMany`, `update`, etc.) as they are fully covered by the isolation sandbox.
 * * **⚠️ findUnique compatibility**: Under the hood, `findUnique` operations are converted to `findFirst` to allow filtering on both unique fields and the non-unique `tenantId` field.
 * * **⚠️ Upsert operations**: `upsert` queries are translated to sequential search + write operations. This ensures that created or updated records are scoped correctly to the active tenant.
 * * **❌ DO NOT construct new Prisma clients**: Always use the shared database client created at server bootstrap, which is pre-configured with the query filters.
 * ╚═════════════════════════════════╝
 */

import { Prisma } from '../../generated/prisma/client.js';
import { tenantContext } from '../../shared/utils/TenantContext.js';

/**
 * Prisma Client Extension that enforces multi-tenant database isolation.
 * For every model that contains a `tenantId` field, it automatically:
 * 1. Restricts reads (findMany, findFirst, count, etc.) to the active tenant.
 * 2. Scopes creates/upserts to the active tenant.
 * 3. Prevents unauthorized updates/deletions of other tenants' records.
 */
export const tenantIsolationExtension = Prisma.defineExtension((client) => {
    // Dynamically identify all database models that contain a `tenantId` column
    const modelsWithTenantId = Object.keys(Prisma.ModelName).filter((modelName) => {
        const enumName = `${modelName}ScalarFieldEnum`;
        const fieldEnum = (Prisma as any)[enumName];
        return fieldEnum && 'tenantId' in fieldEnum;
    });

    const queryExtensions: any = {};

    for (const modelName of modelsWithTenantId) {
        const clientModelName = modelName.charAt(0).toLowerCase() + modelName.slice(1);

        queryExtensions[clientModelName] = {
            async $allOperations({ operation, args, query }: any) {
                const currentTenantId = tenantContext.getTenantId();

                // Only apply isolation checks if a tenant context is active.
                // Cron jobs, startup seeders, and public/super-admin tasks run without context and skip filters.
                if (currentTenantId) {
                    if (operation === 'create') {
                        args.data = args.data || {};
                        args.data.tenantId = currentTenantId;
                    } else if (operation === 'findUnique') {
                        // findUnique only allows querying unique fields in Prisma.
                        // Translate findUnique to findFirst to support filtering by tenantId dynamically.
                        args.where = args.where || {};
                        args.where.tenantId = currentTenantId;
                        return (client as any)[clientModelName].findFirst(args);
                    } else if (operation === 'upsert') {
                        // Translate upsert to search + update/create to enforce tenant bounds safely
                        const findArgs = {
                            where: { ...args.where, tenantId: currentTenantId },
                            select: { id: true }
                        };
                        const existing = await (client as any)[clientModelName].findFirst(findArgs);
                        if (existing) {
                            // Proceed with update
                            return (client as any)[clientModelName].update({
                                where: args.where,
                                data: args.update
                            });
                        } else {
                            // Proceed with create, injecting tenantId
                            return (client as any)[clientModelName].create({
                                data: {
                                    ...args.create,
                                    tenantId: currentTenantId
                                }
                            });
                        }
                    } else if (operation === 'update' || operation === 'delete') {
                        // Enforce unique record ownership before letting the update/delete run
                        const existing = await (client as any)[clientModelName].findFirst({
                            where: { ...args.where, tenantId: currentTenantId },
                            select: { id: true }
                        });
                        if (!existing) {
                            throw new Error(`Tenant Isolation Breach: Record not found or inaccessible under current tenant scope (${currentTenantId}).`);
                        }
                        // Record belongs to active tenant — query is safe to proceed
                    } else if ([
                        'findMany', 'findFirst', 'count', 'aggregate', 
                        'groupBy', 'deleteMany', 'updateMany'
                    ].includes(operation)) {
                        args.where = args.where || {};
                        args.where.tenantId = currentTenantId;
                    }
                }

                return query(args);
            }
        };
    }

    return client.$extends({
        query: queryExtensions
    });
});
