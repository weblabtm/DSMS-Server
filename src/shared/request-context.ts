export type TenantRoutingContext = {
    host: string;
    hostname: string;
    tenantSlug?: string;
    apiBaseUrl: string;
};

declare module 'express-serve-static-core' {
    interface Request {
        tenantContext?: TenantRoutingContext;
    }
}