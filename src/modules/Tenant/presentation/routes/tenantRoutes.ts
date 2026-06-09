import { Router } from 'express';
import type { TenantController } from '../controllers/TenantController.js';
import type { AuthorizationMiddleware } from '../../../Auth/application/middleware/AuthorizationMiddleware.js';

export const createTenantRouter = (controller: TenantController, auth: AuthorizationMiddleware) => {
    const router = Router();

    // POST /tenant/ - create tenant (with adminAccount)
    router.post('/', auth.require('tenant.manage'), controller.create.bind(controller));

    // GET /tenant/slug/:slug/availability - check slug availability (Public)
    router.get('/slug/:slug/availability', controller.checkSlugAvailability.bind(controller));

    // GET /tenant/slug/:slug - find tenant by slug
    router.get('/slug/:slug', auth.require('tenant.manage'), controller.getBySlug.bind(controller));

    // GET /tenant/ - list
    router.get('/', auth.require('tenant.manage'), controller.list.bind(controller));

    // GET /tenant/:id - get
    router.get('/:id', auth.require('tenant.manage'), controller.get.bind(controller));

    // PATCH /tenant/:id - update (name or isActive)
    router.patch('/:id', auth.require('tenant.manage'), controller.update.bind(controller));

    // PATCH /tenant/:id/branding - update branding (Super Admin or own Tenant Admin)
    router.patch('/:id/branding', auth.require('tenant.manage'), controller.updateBranding.bind(controller));

    // PATCH /tenant/:id/plan - update plan tier (Super Admin only, enforced in controller)
    router.patch('/:id/plan', auth.require('tenant.manage'), controller.updatePlan.bind(controller));

    return router;
};
