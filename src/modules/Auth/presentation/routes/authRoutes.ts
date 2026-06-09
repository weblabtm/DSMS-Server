import { Router, type RequestHandler } from 'express';
import { AuthenticationMiddleware } from '../../application/middleware/AuthenticationMiddleware.js';
import type { AuthController } from '../controllers/AuthController.js';

export const createAuthRouter = (
    controller: AuthController,
    authenticationMiddleware: AuthenticationMiddleware,
    otpRateLimiter: RequestHandler
) => {
    const router = Router();

    // POST /auth/register
    router.post('/register', authenticationMiddleware.handleOptional.bind(authenticationMiddleware), controller.register.bind(controller));

    // POST /auth/login
    router.post('/login', controller.login.bind(controller));

    // POST /auth/login/complete
    router.post('/login/complete', controller.completeLogin.bind(controller));

    // GET /auth/unlock
    router.get('/unlock', controller.unlock.bind(controller));

    // GET /auth/unlock/details
    router.get('/unlock/details', controller.getUnlockDetails.bind(controller));

    // POST /auth/refresh
    router.post('/refresh', controller.refresh.bind(controller));

    // POST /auth/logout
    router.post('/logout', controller.logout.bind(controller));

    // POST /auth/captcha/validate
    router.post('/captcha/validate', controller.validateCaptcha.bind(controller));

    // POST /auth/otp/generate
    router.post('/otp/generate', otpRateLimiter, controller.generateOtp.bind(controller));

    // POST /auth/otp/validate
    router.post('/otp/validate', controller.validateOtp.bind(controller));

    // GET /auth/sessions  – list all active sessions for the authenticated user
    router.get('/sessions', authenticationMiddleware.handle.bind(authenticationMiddleware), controller.getActiveSessions.bind(controller));

    // DELETE /auth/sessions/:sessionId  – revoke a specific session
    router.delete('/sessions/:sessionId', authenticationMiddleware.handle.bind(authenticationMiddleware), controller.revokeSession.bind(controller));

    return router;
};
