import { Router } from 'express';
import type { AuthController } from '../controllers/AuthController.js';

export const createAuthRouter = (controller: AuthController) => {
    const router = Router();

    // POST /auth/register
    router.post('/register', controller.register.bind(controller));

    // POST /auth/login
    router.post('/login', controller.login.bind(controller));

    // POST /auth/refresh
    router.post('/refresh', controller.refresh.bind(controller));

    // POST /auth/logout
    router.post('/logout', controller.logout.bind(controller));

    return router;
};
