import { Router } from 'express';
import type { TenantController } from '../controllers/TenantController.js';

export const createTenantRouter = (controller: TenantController) => {
    const router = Router();

    // POST /tenant/ - create tenant (with adminAccount)
    router.post('/', controller.create.bind(controller));

    // GET /tenant/slug/:slug/availability - check slug availability
    router.get('/slug/:slug/availability', controller.checkSlugAvailability.bind(controller));

    // GET /tenant/slug/:slug - find tenant by slug
    router.get('/slug/:slug', controller.getBySlug.bind(controller));

    // GET /tenant/ - list
    router.get('/', controller.list.bind(controller));

    // GET /tenant/:id - get
    router.get('/:id', controller.get.bind(controller));

    // PATCH /tenant/:id - update (name or isActive)
    router.patch('/:id', controller.update.bind(controller));

    return router;
};
