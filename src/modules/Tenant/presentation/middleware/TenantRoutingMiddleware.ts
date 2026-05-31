import type { NextFunction, Request, Response } from 'express';

import type { TenantRoutingContext } from '../../../../shared/request-context.js';

const RESERVED_SUBDOMAINS = new Set(['api', 'app', 'admin', 'www']);

const isLikelyIpAddress = (host: string): boolean => /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || /^[\da-f:]+$/i.test(host);

export class TenantRoutingMiddleware {
    public constructor(private readonly enableSubdomainRouting = false) {}

    public handle(request: Request, _response: Response, next: NextFunction): void {
        request.tenantContext = this.resolveTenantContext(request);
        next();
    }

    private resolveTenantContext(request: Request): TenantRoutingContext {
        const forwardedHost = this.getHeaderValue(request.headers['x-forwarded-host']);
        const host = forwardedHost ?? this.getHeaderValue(request.headers.host) ?? request.hostname ?? 'localhost';
        const hostname = this.stripPort(host);
        const protocol = this.getProtocol(request);
        const tenantSlug = this.enableSubdomainRouting ? this.resolveTenantSlug(hostname) : undefined;

        return {
            host,
            hostname,
            ...(tenantSlug ? { tenantSlug } : {}),
            apiBaseUrl: `${protocol}://${host}`,
        };
    }

    private resolveTenantSlug(hostname: string): string | undefined {
        const normalizedHost = hostname.toLowerCase();

        if (!normalizedHost || normalizedHost === 'localhost' || isLikelyIpAddress(normalizedHost)) {
            return undefined;
        }

        const labels = normalizedHost.split('.').filter((label) => label.length > 0);

        if (labels.length < 2) {
            return undefined;
        }

        const firstLabel = labels[0];

        if (RESERVED_SUBDOMAINS.has(firstLabel)) {
            return undefined;
        }

        return firstLabel;
    }

    private stripPort(host: string): string {
        if (host.startsWith('[')) {
            const closingBracketIndex = host.indexOf(']');

            if (closingBracketIndex > 0) {
                return host.slice(1, closingBracketIndex);
            }
        }

        const firstColonIndex = host.indexOf(':');
        const lastColonIndex = host.lastIndexOf(':');

        if (firstColonIndex > -1 && firstColonIndex === lastColonIndex) {
            return host.slice(0, firstColonIndex);
        }

        return host;
    }

    private getHeaderValue(value: string | string[] | undefined): string | undefined {
        if (Array.isArray(value)) {
            return value[0];
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();

            return trimmed.length > 0 ? trimmed.split(',')[0].trim() : undefined;
        }

        return undefined;
    }

    private getProtocol(request: Request): string {
        const forwardedProto = this.getHeaderValue(request.headers['x-forwarded-proto']);

        return forwardedProto ?? request.protocol ?? 'http';
    }
}