import { describe, expect, it, vi } from 'vitest';

import { TenantController } from '../../../../src/modules/Tenant/presentation/controllers/TenantController.js';
import { ForbiddenError } from '../../../../src/shared/errors/ForbiddenError.js';

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
            createTenant: vi.fn().mockResolvedValue({ id: 'tenant-1', name: 'School 1', slug: 'school-1', isActive: true }),
            getTenant: vi.fn(),
            getTenantBySlug: vi.fn(),
            isSlugAvailable: vi.fn(),
            listTenants: vi.fn(),
            updateTenant: vi.fn(),
        };
        const controller = new TenantController(tenantService as never);
        const response = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        await controller.create({ body: { name: 'School 1', slug: 'school-1', tenantAdminIdentifier: 'admin@school' }, authContext: { isSuperAdmin: () => true, hasRole: () => false } } as never, response as never);

        expect(tenantService.createTenant).toHaveBeenCalledWith({
            name: 'School 1',
            slug: 'school-1',
            tenantAdminIdentifier: 'admin@school',
        });
        expect(response.status).toHaveBeenCalledWith(201);
    });

    it('rejects list tenants for non-super-admin users', async () => {
        const tenantService = {
            listTenants: vi.fn(),
        };
        const controller = new TenantController(tenantService as never);
        const response = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        const call = () => controller.list({ authContext: { isSuperAdmin: () => false } } as never, response as never);
        await expect(call()).rejects.toThrow(ForbiddenError);
    });

    it('allows list tenants for super-admin users', async () => {
        const tenantService = {
            listTenants: vi.fn().mockResolvedValue([{ id: 'tenant-1', name: 'School 1' }]),
        };
        const controller = new TenantController(tenantService as never);
        const response = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        await controller.list({ authContext: { isSuperAdmin: () => true } } as never, response as never);

        expect(tenantService.listTenants).toHaveBeenCalled();
        expect(response.status).toHaveBeenCalledWith(200);
    });

    it('rejects get tenant for different tenant users', async () => {
        const tenantService = {
            // Returns a tenant owned by 'tenant-2', so 'tenant-1' user cannot access it.
            getTenant: vi.fn().mockResolvedValue({ id: 'tenant-2', name: 'School 2', slug: 'school-2' }),
        };
        const controller = new TenantController(tenantService as never);
        const response = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        const call = () => controller.get({ params: { id: 'tenant-2' }, authContext: { isSuperAdmin: () => false, tenantId: 'tenant-1' } } as never, response as never);
        await expect(call()).rejects.toThrow(ForbiddenError);
    });

    it('allows get tenant for self tenant users', async () => {
        const tenantService = {
            getTenant: vi.fn().mockResolvedValue({ id: 'tenant-1', name: 'School 1' }),
        };
        const controller = new TenantController(tenantService as never);
        const response = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        await controller.get({ params: { id: 'tenant-1' }, authContext: { isSuperAdmin: () => false, tenantId: 'tenant-1' } } as never, response as never);

        expect(tenantService.getTenant).toHaveBeenCalledWith('tenant-1');
        expect(response.status).toHaveBeenCalledWith(200);
    });

    it('rejects update tenant for non-admin different tenant users', async () => {
        const tenantService = {
            // Tenant 'tenant-2' — the requesting user belongs to 'tenant-1'.
            getTenant: vi.fn().mockResolvedValue({ id: 'tenant-2', name: 'School 2', slug: 'school-2' }),
            updateTenant: vi.fn(),
        };
        const controller = new TenantController(tenantService as never);
        const response = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        const call = () => controller.update({ params: { id: 'tenant-2' }, body: { name: 'New Name' }, authContext: { isSuperAdmin: () => false, hasRole: () => true, tenantId: 'tenant-1' } } as never, response as never);
        await expect(call()).rejects.toThrow(ForbiddenError);
    });

    it('allows update tenant for self tenant admin users', async () => {
        const tenantService = {
            // The authContext.tenantId is 'school-1' (slug), matching tenant.slug.
            getTenant: vi.fn().mockResolvedValue({ id: 'tenant-1', name: 'School 1', slug: 'school-1' }),
            updateTenant: vi.fn().mockResolvedValue({ id: 'tenant-1', name: 'New Name' }),
        };
        const controller = new TenantController(tenantService as never);
        const response = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        // tenantId is 'school-1' (slug) — matches tenant.slug in the mock.
        await controller.update({ params: { id: 'tenant-1' }, body: { name: 'New Name' }, authContext: { isSuperAdmin: () => false, hasRole: (role: string) => role === 'Tenant Admin', tenantId: 'school-1' } } as never, response as never);

        expect(tenantService.updateTenant).toHaveBeenCalledWith('tenant-1', { name: 'New Name', isActive: undefined });
        expect(response.status).toHaveBeenCalledWith(200);
    });
});
