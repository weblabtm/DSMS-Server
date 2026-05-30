import { describe, expect, it, vi } from 'vitest';

import { TenantController } from '../../../../src/modules/Tenant/presentation/controllers/TenantController.js';

describe('TenantController', () => {
    it('rejects tenant creation for non-super-admin users', async () => {
        const tenantService = {
            createTenant: vi.fn(),
            getTenant: vi.fn(),
            listTenants: vi.fn(),
            updateTenant: vi.fn(),
        };
        const controller = new TenantController(tenantService as never);
        const response = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        await controller.create({ body: { name: 'School 1', tenantAdminIdentifier: 'admin@school' }, authContext: { isSuperAdmin: () => false, hasRole: () => false } } as never, response as never);

        expect(tenantService.createTenant).not.toHaveBeenCalled();
        expect(response.status).toHaveBeenCalledWith(403);
    });

    it('allows tenant creation only for super admin users', async () => {
        const tenantService = {
            createTenant: vi.fn().mockResolvedValue({ id: 'tenant-1', name: 'School 1', isActive: true }),
            getTenant: vi.fn(),
            listTenants: vi.fn(),
            updateTenant: vi.fn(),
        };
        const controller = new TenantController(tenantService as never);
        const response = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        await controller.create({ body: { name: 'School 1', tenantAdminIdentifier: 'admin@school' }, authContext: { isSuperAdmin: () => true, hasRole: () => false } } as never, response as never);

        expect(tenantService.createTenant).toHaveBeenCalledWith({
            name: 'School 1',
            tenantAdminIdentifier: 'admin@school',
        });
        expect(response.status).toHaveBeenCalledWith(201);
    });
});
