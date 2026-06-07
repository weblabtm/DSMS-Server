import { randomUUID } from 'crypto';
import type { TenantDao } from '../dao/TenantDao.js';
import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { getFeaturesForPlan, isValidPlanTier } from '../../domain/PlanTier.js';
import type { UpdateTenantBrandingRequestDto, UpdateTenantPlanRequestDto } from '../dtos/TenantDtos.js';

export type CreateTenantInput = {
    name: string;
    slug: string;
    tenantAdminIdentifier: string;
};

const RESERVED_TENANT_SLUGS = new Set(['admin', 'app', 'api', 'www', 'test', 'dsms', 'root', 'saas', 'server', 'localhost']);

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

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

/** Shared mapper — converts a raw DB row to the full tenant response shape. */
const mapRow = (row: any) => ({
    id: row.id,
    name: row.name,
    slug: row.slug ?? null,
    isActive: row.isActive,
    branding: {
        logoUrl: row.logoUrl ?? null,
        primaryColor: row.primaryColor ?? null,
        secondaryColor: row.secondaryColor ?? null,
        faviconUrl: row.faviconUrl ?? null,
    },
    planTier: row.planTier ?? 'BASIC',
    planExpiresAt: row.planExpiresAt ? new Date(row.planExpiresAt as string) : null,
    featureFlags: getFeaturesForPlan(row.planTier ?? 'BASIC'),
    createdAt: new Date(row.createdAt as string),
    updatedAt: new Date(row.updatedAt as string),
});

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
            const tenantAdmin = await (this.prismaClient as any).authUser.findUnique({
                where: { identifier: input.tenantAdminIdentifier },
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

            const created = await tenantDelegate.create({
                data: { id, name: input.name, slug, isActive: true, planTier: 'BASIC' },
            });

            await (this.prismaClient as any).authUser.update({
                where: { id: tenantAdmin.id },
                data: { tenantId: slug },
            });

            await (this.prismaClient as any).authSession.updateMany({
                where: { userId: tenantAdmin.id, revokedAt: null },
                data: { tenantId: slug },
            });

            return mapRow(created);
        }

        throw new Error('Tenant creation requires a database-backed Tenant Admin account lookup');
    }

    public async getTenant(id: string) {
        if (this.prismaClient) {
            const tenantDelegate = this.getTenantDelegate();
            const found = await tenantDelegate.findUnique({ where: { id } });

            if (!found) return null;

            return mapRow(found);
        }

        const t = await this.tenantDao.findById(id);

        if (!t) return null;

        return t;
    }

    public async listTenants() {
        if (this.prismaClient) {
            const tenantDelegate = this.getTenantDelegate();
            const rows = await tenantDelegate.findMany();
            return rows.map(mapRow);
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

            const tenant = mapRow(found);

            // Enforce plan expiry — return as inactive without writing to DB
            if (tenant.planExpiresAt && tenant.planExpiresAt < new Date()) {
                tenant.isActive = false;
            }

            return tenant;
        }

        return this.tenantDao.findBySlug(normalized);
    }

    public async updateTenant(id: string, patch: { name?: string; isActive?: boolean }) {
        if (this.prismaClient) {
            const tenantDelegate = this.getTenantDelegate();
            const updated = await tenantDelegate.update({
                where: { id },
                data: {
                    ...(patch.name ? { name: patch.name } : {}),
                    ...(typeof patch.isActive === 'boolean' ? { isActive: patch.isActive } : {}),
                },
            });

            return mapRow(updated);
        }

        const updated = await this.tenantDao.update(id, patch as any);
        return updated;
    }

    public async updateBranding(id: string, patch: UpdateTenantBrandingRequestDto) {
        // Validate hex colors
        if (patch.primaryColor && !HEX_COLOR_PATTERN.test(patch.primaryColor)) {
            throw new Error('primaryColor must be a valid hex color (e.g. #6366f1)');
        }
        if (patch.secondaryColor && !HEX_COLOR_PATTERN.test(patch.secondaryColor)) {
            throw new Error('secondaryColor must be a valid hex color (e.g. #3b82f6)');
        }
        // Validate URLs are HTTPS
        if (patch.logoUrl && !patch.logoUrl.startsWith('https://')) {
            throw new Error('logoUrl must be an HTTPS URL');
        }
        if (patch.faviconUrl && !patch.faviconUrl.startsWith('https://')) {
            throw new Error('faviconUrl must be an HTTPS URL');
        }

        if (!this.prismaClient) {
            throw new Error('updateBranding requires a database-backed Prisma client');
        }

        const tenantDelegate = this.getTenantDelegate();

        // Build only the provided fields
        const data: Record<string, unknown> = {};
        if ('logoUrl' in patch) data.logoUrl = patch.logoUrl ?? null;
        if ('primaryColor' in patch) data.primaryColor = patch.primaryColor ?? null;
        if ('secondaryColor' in patch) data.secondaryColor = patch.secondaryColor ?? null;
        if ('faviconUrl' in patch) data.faviconUrl = patch.faviconUrl ?? null;

        const updated = await tenantDelegate.update({ where: { id }, data });
        return mapRow(updated);
    }

    public async updatePlan(id: string, patch: UpdateTenantPlanRequestDto) {
        if (!isValidPlanTier(patch.planTier)) {
            throw new Error(`Invalid planTier. Must be one of: BASIC, STANDARD, PREMIUM`);
        }

        let planExpiresAt: Date | null = null;

        if (patch.planExpiresAt) {
            const expiry = new Date(patch.planExpiresAt);

            if (isNaN(expiry.getTime())) {
                throw new Error('planExpiresAt must be a valid ISO date string');
            }

            if (expiry <= new Date()) {
                throw new Error('planExpiresAt must be a date in the future');
            }

            planExpiresAt = expiry;
        }

        if (!this.prismaClient) {
            throw new Error('updatePlan requires a database-backed Prisma client');
        }

        const tenantDelegate = this.getTenantDelegate();

        const updated = await tenantDelegate.update({
            where: { id },
            data: {
                planTier: patch.planTier,
                planExpiresAt: planExpiresAt,
            },
        });

        return mapRow(updated);
    }
}
