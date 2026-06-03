import { Router } from 'express';
import type { SmsNotificationController } from '../controllers/SmsNotificationController.js';
import type { AuthenticationMiddleware } from '../../../Auth/application/middleware/AuthenticationMiddleware.js';

export const createNotificationRouter = (
    controller: SmsNotificationController,
    authenticationMiddleware: AuthenticationMiddleware
) => {
    const router = Router();

    // 1. Send/Queue Outbound SMS (requires authenticated context)
    router.post(
        '/sms/send',
        authenticationMiddleware.handle.bind(authenticationMiddleware),
        controller.sendSms.bind(controller)
    );

    // 2. Twilio Status Callback (public webhook, called by Twilio)
    router.post(
        '/sms/callback',
        controller.handleCallback.bind(controller)
    );

    return router;
};
// Default export for flexibility
export default createNotificationRouter;
