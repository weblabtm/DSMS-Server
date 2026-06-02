import { Notification } from './Notification.js';

export class EmailNotification extends Notification {
    public override readonly type = 'email';

    public constructor(
        recipient: string, // Email address
        body: string,      // HTML or plain text body
        public readonly subject: string,
        tenantId?: string,
        branchId?: string
    ) {
        super(recipient, body, tenantId, branchId);
    }
}
