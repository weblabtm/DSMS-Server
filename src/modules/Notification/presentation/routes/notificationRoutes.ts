/**
 * CRITICAL WARNING:
 * Notification endpoints must NOT be exposed at any cost.
 * DO NOT mount this router or any of its associated middlewares in the main application router.
 * All notification triggers must be performed exclusively in-app via polymorphic NotificationSender instances
 * (such as SmsNotificationSender or EmailNotificationSender).
 */

import { Router } from 'express';
import type { SmsNotificationController } from '../controllers/SmsNotificationController.js';
import type { AuthenticationMiddleware } from '../../../Auth/application/middleware/AuthenticationMiddleware.js';
import type { AuthorizationMiddleware } from '../../../Auth/application/middleware/AuthorizationMiddleware.js';

export const createNotificationRouter = (
    controller: SmsNotificationController,
    authenticationMiddleware: AuthenticationMiddleware,
    auth: AuthorizationMiddleware
) => {
    const router = Router();

    // 1. Send/Queue Outbound SMS (requires authenticated context and notification.manage permission)
    router.post(
        '/sms/send',
        authenticationMiddleware.handle.bind(authenticationMiddleware),
        auth.require('notification.manage'),
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
