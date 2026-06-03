import { randomUUID } from 'crypto';
import type { TenantDao } from '../dao/TenantDao.js';
import type { PrismaClient } from '../../../../generated/prisma/client.js';

export type CreateTenantInput = {
    name: string;
    slug: string;
    tenantAdminIdentifier: string;
};

const RESERVED_TENANT_SLUGS = new Set(['admin', 'app', 'api', 'www', 'test', 'dsms', 'root', 'saas', 'server', 'localhost']);

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

const normalizeTenantSlug = (slug: string): string => {
    return slug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
};

const isTenantSlugFormatValid = (slug: string): boolean => {
    return slug.length >= 3 && slug.length <= 63 && SLUG_PATTERN.test(slug);
};

export class TenantService {
    public constructor(private readonly tenantDao: TenantDao, private readonly prismaClient?: PrismaClient) { }

    private getTenantDelegate(): any {
        const delegate = (this.prismaClient as any)?.tenant;

        if (!delegate) {
            throw new Error('Tenant model is not available in Prisma client. Run npm run prisma:generate and restart the server.');
        }

        return delegate;
    }

    public normalizeSlug(slug: string): string {
        return normalizeTenantSlug(slug);
    }

    public async isSlugAvailable(slug: string): Promise<{ slug: string; available: boolean; reason?: 'invalid' | 'reserved' | 'taken' }> {
        const normalized = normalizeTenantSlug(slug);

        if (!normalized || !isTenantSlugFormatValid(normalized)) {
            return { slug: normalized, available: false, reason: 'invalid' };
        }

        if (RESERVED_TENANT_SLUGS.has(normalized)) {
            return { slug: normalized, available: false, reason: 'reserved' };
        }

        if (this.prismaClient) {
            const tenantDelegate = this.getTenantDelegate();
            const existing = await tenantDelegate.findFirst({ where: { slug: normalized } });

            if (existing) {
                return { slug: normalized, available: false, reason: 'taken' };
            }
        } else {
            const existing = await this.tenantDao.findBySlug(normalized);

            if (existing) {
                return { slug: normalized, available: false, reason: 'taken' };
            }
        }

        return { slug: normalized, available: true };
    }

    public async createTenant(input: CreateTenantInput) {
        const id = `tenant-${randomUUID()}`;
        const slug = normalizeTenantSlug(input.slug);

        if (!slug || !isTenantSlugFormatValid(slug)) {
            throw new Error('Invalid tenant slug');
        }

        if (RESERVED_TENANT_SLUGS.has(slug)) {
            throw new Error('Tenant slug is reserved');
        }

        if (this.prismaClient) {
            const tenantDelegate = this.getTenantDelegate();
            const tenantAdmin = await (this.prismaClient as any).authUser.findFirst({
                where: { identifier: input.tenantAdminIdentifier, tenantId: null },
            });

            if (!tenantAdmin) {
                throw new Error('Tenant Admin account not found');
            }

            if (!(tenantAdmin.roles ?? []).includes('Tenant Admin')) {
                throw new Error('Provided account is not a Tenant Admin');
            }

            if (tenantAdmin.tenantId) {
                throw new Error('Tenant Admin account is already assigned to a tenant');
            }

            const existingTenant = await tenantDelegate.findFirst({ where: { slug } });

            if (existingTenant) {
                throw new Error('Tenant slug is already in use');
            }

            const created = await tenantDelegate.create({ data: { id, name: input.name, slug, isActive: true } });

            await (this.prismaClient as any).authUser.update({
                where: { id: tenantAdmin.id },
                data: { tenantId: slug },
            });

            await (this.prismaClient as any).authSession.updateMany({
                where: { userId: tenantAdmin.id, revokedAt: null },
                data: { tenantId: slug },
            });

            return {
                id: created.id,
                name: created.name,
                slug: created.slug ?? slug,
                isActive: created.isActive,
                createdAt: new Date(created.createdAt as string),
                updatedAt: new Date(created.updatedAt as string),
            };
        }

        throw new Error('Tenant creation requires a database-backed Tenant Admin account lookup');
    }

    public async getTenant(id: string) {
        if (this.prismaClient) {
            const tenantDelegate = this.getTenantDelegate();
            const found = await tenantDelegate.findUnique({ where: { id } });

            if (!found) return null;

            return {
                id: found.id,
                name: found.name,
                slug: found.slug ?? null,
                isActive: found.isActive,
                createdAt: new Date(found.createdAt as string),
                updatedAt: new Date(found.updatedAt as string),
            };
        }

        const t = await this.tenantDao.findById(id);

        if (!t) return null;

        return t;
    }

    public async listTenants() {
        if (this.prismaClient) {
            const tenantDelegate = this.getTenantDelegate();
            const rows = await tenantDelegate.findMany();
            return rows.map((r: any) => ({ id: r.id, name: r.name, slug: r.slug ?? null, isActive: r.isActive, createdAt: new Date(r.createdAt as string), updatedAt: new Date(r.updatedAt as string) }));
        }

        return this.tenantDao.list();
    }

    public async getTenantBySlug(slug: string) {
        const normalized = normalizeTenantSlug(slug);

        if (!normalized) {
            return null;
        }

        if (this.prismaClient) {
            const tenantDelegate = this.getTenantDelegate();
            const found = await tenantDelegate.findFirst({ where: { slug: normalized } });

            if (!found) return null;

            return {
                id: found.id,
                name: found.name,
                slug: found.slug ?? null,
                isActive: found.isActive,
                createdAt: new Date(found.createdAt as string),
                updatedAt: new Date(found.updatedAt as string),
            };
        }

        return this.tenantDao.findBySlug(normalized);
    }

    public async updateTenant(id: string, patch: { name?: string; isActive?: boolean }) {
        // tenants cannot be deleted; allow name change and deactivate/reactivate
        if (this.prismaClient) {
            const tenantDelegate = this.getTenantDelegate();
            const updated = await tenantDelegate.update({ where: { id }, data: { ...(patch.name ? { name: patch.name } : {}), ...(typeof patch.isActive === 'boolean' ? { isActive: patch.isActive } : {}) } });

            return {
                id: updated.id,
                name: updated.name,
                slug: updated.slug ?? null,
                isActive: updated.isActive,
                createdAt: new Date(updated.createdAt as string),
                updatedAt: new Date(updated.updatedAt as string),
            };
        }

        const updated = await this.tenantDao.update(id, patch as any);
        return updated;
    }
}
