import { describe, expect, it } from 'vitest';
import { SmsNotification } from '../../../../src/modules/Notification/domain/SmsNotification.js';
import { SmsNotificationSender } from '../../../../src/modules/Notification/application/services/SmsNotificationSender.js';
import { SmsNotificationService } from '../../../../src/modules/Notification/application/services/SmsNotificationService.js';

describe('SmsNotification & SmsNotificationSender OOP domain', () => {
    it('creates an SmsNotification correctly and inherits properties from Notification abstract class', () => {
        const sms = new SmsNotification('+1234567890', 'Test Body', 'tenant-123', 'branch-456');

        expect(sms.recipient).toBe('+1234567890');
        expect(sms.body).toBe('Test Body');
        expect(sms.tenantId).toBe('tenant-123');
        expect(sms.branchId).toBe('branch-456');
        expect(sms.type).toBe('sms');
    });

    it('SmsNotificationSender delegates to queueSms correctly', async () => {
        let queueCalled = false;
        let recipientPassed = '';
        let bodyPassed = '';
        let tenantPassed = '';
        let branchPassed = '';

        const mockService = {
            queueSms: async (to: string, body: string, tenantId?: string, branchId?: string) => {
                queueCalled = true;
                recipientPassed = to;
                bodyPassed = body;
                tenantPassed = tenantId ?? '';
                branchPassed = branchId ?? '';
                return {} as any;
            }
        } as unknown as SmsNotificationService;

        const sender = new SmsNotificationSender(mockService);
        const sms = new SmsNotification('+987654321', 'Hello SOLID', 't1', 'b1');
        await sender.send(sms);

        expect(queueCalled).toBe(true);
        expect(recipientPassed).toBe('+987654321');
        expect(bodyPassed).toBe('Hello SOLID');
        expect(tenantPassed).toBe('t1');
        expect(branchPassed).toBe('b1');
    });
});
