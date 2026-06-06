import { EmailNotificationService } from './EmailNotificationService.js';
import { SmsNotificationService } from './SmsNotificationService.js';

export type NotificationRecipient = {
    email?: string;
    phoneNumber?: string;
};

export type NotificationContent = {
    subject?: string;
    body: string;
};

export type NotificationOptions = {
    tenantId?: string;
    branchId?: string;
    senderName?: string;
    channels?: ('email' | 'sms')[];
};

export class NotificationService {
    public constructor(
        private readonly emailService: EmailNotificationService,
        private readonly smsService: SmsNotificationService
    ) {}

    /**
     * Sends a notification to the recipient using the specified channels.
     * By default, dispatches to both email and SMS if both are available.
     *
     * @param recipient Recipient email and/or phone number
     * @param content   Subject and body text
     * @param options   Optional metadata, branding, and channels filter
     */
    public async sendNotification(
        recipient: NotificationRecipient,
        content: NotificationContent,
        options: NotificationOptions = {}
    ): Promise<void> {
        const channels = options.channels ?? ['email', 'sms'];
        const promises: Promise<any>[] = [];

        if (channels.includes('email') && recipient.email) {
            promises.push(
                this.emailService.queueEmail(
                    recipient.email,
                    content.subject ?? 'Notification',
                    content.body,
                    options.tenantId,
                    options.branchId
                )
            );
        }

        if (channels.includes('sms') && recipient.phoneNumber) {
            promises.push(
                this.smsService.queueSms(
                    recipient.phoneNumber,
                    content.body,
                    options.tenantId,
                    options.branchId,
                    options.senderName
                )
            );
        }

        await Promise.all(promises);
    }
}
