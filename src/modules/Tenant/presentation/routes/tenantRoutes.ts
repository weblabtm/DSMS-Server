import { Router } from 'express';
import type { TenantController } from '../controllers/TenantController.js';

export const createTenantRouter = (controller: TenantController) => {
    const router = Router();

    // POST /tenant/ - create tenant (with adminAccount)
    router.post('/', controller.create.bind(controller));

    // GET /tenant/ - list
    router.get('/', controller.list.bind(controller));

    // GET /tenant/:id - get
    router.get('/:id', controller.get.bind(controller));

    // PATCH /tenant/:id - update (name or isActive)
    router.patch('/:id', controller.update.bind(controller));

    return router;
};
