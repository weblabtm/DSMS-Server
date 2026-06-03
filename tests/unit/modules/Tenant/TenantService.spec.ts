import { describe, it, expect, vi, beforeEach } from 'vitest';

import { TenantService } from '../../../../src/modules/Tenant/application/services/TenantService.js';

describe('TenantService', () => {
    let mockPrisma: any;
    let tenantService: TenantService;

    beforeEach(() => {
        mockPrisma = {
            tenant: {
                create: vi.fn(async ({ data }: any) => ({
                    ...data,
                    createdAt: new Date('2026-05-30T00:00:00.000Z'),
                    updatedAt: new Date('2026-05-30T00:00:00.000Z'),
                })),
                findFirst: vi.fn(async ({ where }: any) => where.slug === 'taken-slug' ? ({
                    id: 't2',
                    name: 'Taken',
                    slug: 'taken-slug',
                    isActive: true,
                    createdAt: new Date('2026-05-30T00:00:00.000Z'),
                    updatedAt: new Date('2026-05-30T00:00:00.000Z'),
                }) : null),
                findUnique: vi.fn(async ({ where }: any) => where.id === 't1' ? ({
                    id: 't1',
                    name: 'T1',
                    slug: 't1-slug',
                    isActive: true,
                    createdAt: new Date('2026-05-30T00:00:00.000Z'),
                    updatedAt: new Date('2026-05-30T00:00:00.000Z'),
                }) : null),
                findMany: vi.fn(async () => []),
                update: vi.fn(async ({ where, data }: any) => ({
                    id: where.id,
                    name: data.name ?? 'T1',
                    slug: data.slug ?? 't1-slug',
                    isActive: data.isActive ?? false,
                    createdAt: new Date('2026-05-30T00:00:00.000Z'),
                    updatedAt: new Date('2026-05-30T00:00:00.000Z'),
                })),
            },
            authUser: {
                findUnique: vi.fn(async ({ where }: any) => where.identifier === 'admin@acme' ? ({
                    id: 'u1',
                    identifier: 'admin@acme',
                    roles: ['Tenant Admin'],
                    tenantId: null,
                }) : null),
                update: vi.fn(async ({ where, data }: any) => ({
                    id: where.id,
                    tenantId: data.tenantId,
                })),
            },
            authSession: {
                updateMany: vi.fn(async () => ({ count: 1 })),
            },
        };

        tenantService = new TenantService({} as never, mockPrisma as never);
    });

    it('creates a tenant and links the initial tenant admin account', async () => {
        const result = await tenantService.createTenant({ name: 'Acme', slug: 'acme', tenantAdminIdentifier: 'admin@acme' });

        expect(result).toHaveProperty('id');
        expect(result.name).toBe('Acme');
        expect(result.slug).toBe('acme');
        expect(result.isActive).toBe(true);

        expect(mockPrisma.authUser.findUnique).toHaveBeenCalledWith({ where: { identifier: 'admin@acme' } });
        expect(mockPrisma.tenant.create).toHaveBeenCalled();
        expect(mockPrisma.authUser.update).toHaveBeenCalledWith({
            where: { id: 'u1' },
            data: { tenantId: 'acme' },
        });
        expect(mockPrisma.authSession.updateMany).toHaveBeenCalledWith({
            where: { userId: 'u1', revokedAt: null },
            data: { tenantId: 'acme' },
        });
    });

    it('rejects taken tenant slugs', async () => {
        await expect(tenantService.isSlugAvailable('taken-slug')).resolves.toEqual({
            slug: 'taken-slug',
            available: false,
            reason: 'taken',
        });
    });

    it('updates tenant to deactivate', async () => {
        const updated = await tenantService.updateTenant('t1', { isActive: false });

        expect(updated.isActive).toBe(false);
        expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
            where: { id: 't1' },
            data: { isActive: false },
        });
    });
});
