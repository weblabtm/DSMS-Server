/**
 * Resolves the tenant slug from HTTP request headers (checking Origin, Referer, and Host).
 */
export function resolveTenantSlug(headers: Record<string, string | string[] | undefined> | undefined): string | undefined {
    if (!headers) return undefined;

    // We only resolve the tenant from the 'x-tenant-id' header.
    // Subdomain / Host / Origin / Referer resolution is disabled.
    const tenantId = headers['x-tenant-id'];
    if (typeof tenantId === 'string') {
        return tenantId.trim() || undefined;
    }
    if (Array.isArray(tenantId) && tenantId.length > 0) {
        return tenantId[0].trim() || undefined;
    }

    return undefined;
}

