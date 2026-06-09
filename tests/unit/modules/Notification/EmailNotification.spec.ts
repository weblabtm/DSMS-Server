import { describe, expect, it } from 'vitest';
import { EmailNotification } from '../../../../src/modules/Notification/domain/EmailNotification.js';
import { EmailNotificationSender } from '../../../../src/modules/Notification/application/services/EmailNotificationSender.js';
import { EmailNotificationService } from '../../../../src/modules/Notification/application/services/EmailNotificationService.js';

describe('EmailNotification & EmailNotificationSender OOP domain', () => {
    it('creates an EmailNotification correctly and inherits properties from Notification abstract class', () => {
        const email = new EmailNotification('recipient@email.com', '<h1>HTML Body</h1>', 'Invoice Paid', 'tenant-123', 'branch-456');

        expect(email.recipient).toBe('recipient@email.com');
        expect(email.body).toBe('<h1>HTML Body</h1>');
        expect(email.subject).toBe('Invoice Paid');
        expect(email.tenantId).toBe('tenant-123');
        expect(email.branchId).toBe('branch-456');
        expect(email.type).toBe('email');
    });

    it('EmailNotificationSender delegates to queueEmail correctly', async () => {
        let queueCalled = false;
        let recipientPassed = '';
        let subjectPassed = '';
        let bodyPassed = '';
        let tenantPassed = '';
        let branchPassed = '';

        const mockService = {
            queueEmail: async (to: string, subject: string, body: string, tenantId?: string, branchId?: string) => {
                queueCalled = true;
                recipientPassed = to;
                subjectPassed = subject;
                bodyPassed = body;
                tenantPassed = tenantId ?? '';
                branchPassed = branchId ?? '';
                return {} as any;
            }
        } as unknown as EmailNotificationService;

        const sender = new EmailNotificationSender(mockService);
        const email = new EmailNotification('recipient@email.com', 'HTML', 'Subject', 't1', 'b1');
        await sender.send(email);

        expect(queueCalled).toBe(true);
        expect(recipientPassed).toBe('recipient@email.com');
        expect(subjectPassed).toBe('Subject');
        expect(bodyPassed).toBe('HTML');
        expect(tenantPassed).toBe('t1');
        expect(branchPassed).toBe('b1');
    });
});
