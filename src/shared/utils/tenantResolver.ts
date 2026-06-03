/**
 * Resolves the tenant slug from the HTTP Host header.
 */
export function resolveTenantSlugFromHost(host: string | undefined): string | undefined {
    if (!host) return undefined;
    const hostname = host.split(':')[0].toLowerCase();
    
    // If hostname matches localhost, 127.0.0.1 or central domains, no tenant is resolved
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return undefined;
    }

    const mainDomain = 'example.test';
    if (hostname.endsWith(`.${mainDomain}`)) {
        return hostname.slice(0, -(mainDomain.length + 1));
    }
    if (hostname.endsWith('.localhost')) {
        return hostname.slice(0, -('.localhost'.length + 1));
    }

    // Fallback: if there are subdomains, take the first part
    const parts = hostname.split('.');
    if (parts.length > 2) {
        return parts[0];
    }

    return undefined;
}
