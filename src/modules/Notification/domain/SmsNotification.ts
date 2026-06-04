import { Notification } from './Notification.js';

export class SmsNotification extends Notification {
    public override readonly type = 'sms';

    /**
     * Optional pre-resolved sender name (e.g. the tenant's registered business name).
     * When provided, used directly as the Twilio alphanumeric sender ID.
     * The Notification module does not look this up — the caller supplies it.
     */
    public readonly senderName?: string;

    public constructor(
        recipient: string,
        body: string,
        tenantId?: string,
        branchId?: string,
        senderName?: string
    ) {
        super(recipient, body, tenantId, branchId);
        this.senderName = senderName;
    }
}
