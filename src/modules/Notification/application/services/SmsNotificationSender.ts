import { NotificationSender } from '../../domain/NotificationSender.js';
import { SmsNotification } from '../../domain/SmsNotification.js';
import { SmsNotificationService } from './SmsNotificationService.js';

export class SmsNotificationSender extends NotificationSender<SmsNotification> {
    public constructor(private readonly smsService: SmsNotificationService) {
        super();
    }

    public async send(notification: SmsNotification): Promise<void> {
        await this.smsService.queueSms(
            notification.recipient,
            notification.body,
            notification.tenantId,
            notification.branchId,
            notification.senderName  // ← passes caller-supplied name directly (Pattern 2)
        );
    }
}
