/**
 * Port (interface) owned by the Notification module.
 *
 * The Notification module defines only what it needs — a single method
 * that resolves a tenant's display name. Any other module (or adapter)
 * may implement this without the Notification module importing it.
 *
 * This follows the Dependency Inversion Principle:
 *   - Notification depends on this abstraction (not on TenantService or Prisma)
 *   - TenantService (or a thin adapter) depends on this abstraction to fulfil it
 */
export interface ITenantNameResolver {
    /**
     * Returns the tenant's registered display name given its ID or slug.
     * Returns `undefined` if the tenant cannot be found or the name is unavailable.
     */
    resolveNameById(tenantId: string): Promise<string | undefined>;
}
