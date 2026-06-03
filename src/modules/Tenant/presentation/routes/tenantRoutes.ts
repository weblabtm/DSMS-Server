import { Router } from 'express';
import type { TenantController } from '../controllers/TenantController.js';
import type { AuthorizationMiddleware } from '../../Auth/application/middleware/AuthorizationMiddleware.js';

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

    return router;
};
