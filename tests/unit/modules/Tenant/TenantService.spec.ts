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
                findUnique: vi.fn(async ({ where }: any) => where.id === 't1' ? ({
                    id: 't1',
                    name: 'T1',
                    isActive: true,
                    createdAt: new Date('2026-05-30T00:00:00.000Z'),
                    updatedAt: new Date('2026-05-30T00:00:00.000Z'),
                }) : null),
                findMany: vi.fn(async () => []),
                update: vi.fn(async ({ where, data }: any) => ({
                    id: where.id,
                    name: data.name ?? 'T1',
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
        };

        tenantService = new TenantService({} as never, mockPrisma as never);
    });

    it('creates a tenant and links the initial tenant admin account', async () => {
        const result = await tenantService.createTenant({ name: 'Acme', tenantAdminIdentifier: 'admin@acme' });

        expect(result).toHaveProperty('id');
        expect(result.name).toBe('Acme');
        expect(result.isActive).toBe(true);

        expect(mockPrisma.authUser.findUnique).toHaveBeenCalledWith({ where: { identifier: 'admin@acme' } });
        expect(mockPrisma.tenant.create).toHaveBeenCalled();
        expect(mockPrisma.authUser.update).toHaveBeenCalledWith({
            where: { id: 'u1' },
            data: { tenantId: result.id },
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
