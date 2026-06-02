import { NotificationSender } from '../../domain/NotificationSender.js';
import { EmailNotification } from '../../domain/EmailNotification.js';
import { EmailNotificationService } from './EmailNotificationService.js';

export class EmailNotificationSender extends NotificationSender<EmailNotification> {
    public constructor(private readonly emailService: EmailNotificationService) {
        super();
    }

    public async send(notification: EmailNotification): Promise<void> {
        await this.emailService.queueEmail(
            notification.recipient,
            notification.subject,
            notification.body,
            notification.tenantId,
            notification.branchId
        );
    }
}
