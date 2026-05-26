import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryTenantDao } from '../../../../src/modules/Tenant/infrastructure/InMemoryTenantDao.js';
import { TenantService } from '../../../../src/modules/Tenant/application/services/TenantService.js';

describe('TenantService', () => {
    let tenantDao: InMemoryTenantDao;
    let mockAuthService: any;
    let tenantService: TenantService;

    beforeEach(() => {
        tenantDao = new InMemoryTenantDao();
        mockAuthService = { register: vi.fn(async (input: any) => ({ userId: 'u1', roles: [input.role ?? 'Tenant Admin'], tenantId: input.tenantId })) };
        tenantService = new TenantService(tenantDao as any, mockAuthService as any);
    });

    it('creates a tenant and initial tenant admin account', async () => {
        const result = await tenantService.createTenant({ name: 'Acme', adminAccount: { identifier: 'admin@acme', password: 'secret' } });

        expect(result).toHaveProperty('id');
        expect(result.name).toBe('Acme');
        expect(result.isActive).toBe(true);

        expect(mockAuthService.register).toHaveBeenCalled();
        const call = mockAuthService.register.mock.calls[0][0];
        expect(call.identifier).toBe('admin@acme');
        expect(call.tenantId).toBe(result.id);
        expect(call.role).toBe('Tenant Admin');
    });

    it('updates tenant to deactivate', async () => {
        const created = await tenantDao.create({ id: 't1', name: 'T1', isActive: true });

        const updated = await tenantService.updateTenant(created.id, { isActive: false });

        expect(updated.isActive).toBe(false);
    });
});
