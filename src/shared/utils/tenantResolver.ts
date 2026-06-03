/**
 * Resolves the tenant slug from HTTP request headers (checking Origin, Referer, and Host).
 */
export function resolveTenantSlug(headers: Record<string, string | string[] | undefined> | undefined): string | undefined {
    if (!headers) return undefined;

    // 1. Check Origin header (e.g., http://slug.localhost:5173)
    const origin = typeof headers.origin === 'string' ? headers.origin : undefined;
    if (origin) {
        try {
            const url = new URL(origin);
            const slug = extractSlugFromHostname(url.hostname);
            if (slug) return slug;
        } catch {}
    }

    // 2. Check Referer header (e.g., http://slug.localhost:5173/login)
    const referer = typeof headers.referer === 'string' ? headers.referer : undefined;
    if (referer) {
        try {
            const url = new URL(referer);
            const slug = extractSlugFromHostname(url.hostname);
            if (slug) return slug;
        } catch {}
    }

    // 3. Check Host header (e.g., slug.example.test)
    const host = typeof headers.host === 'string' ? headers.host : undefined;
    if (host) {
        const hostname = host.split(':')[0].toLowerCase();
        const slug = extractSlugFromHostname(hostname);
        if (slug) return slug;
    }

    return undefined;
}

function extractSlugFromHostname(hostname: string): string | undefined {
    hostname = hostname.toLowerCase();
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
