import { Notification } from './Notification.js';

export class SmsNotification extends Notification {
    public override readonly type = 'sms';

    public constructor(
        recipient: string,
        body: string,
        tenantId?: string,
        branchId?: string
    ) {
        super(recipient, body, tenantId, branchId);
    }
}
