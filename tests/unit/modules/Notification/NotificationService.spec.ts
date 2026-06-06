import { describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../../../../src/modules/Notification/application/services/NotificationService.js';
import { EmailNotificationService } from '../../../../src/modules/Notification/application/services/EmailNotificationService.js';
import { SmsNotificationService } from '../../../../src/modules/Notification/application/services/SmsNotificationService.js';

describe('NotificationService Orchestrator', () => {
    const makeEmailServiceMock = () => ({
        queueEmail: vi.fn().mockResolvedValue({ id: 'email-123' }),
    } as unknown as EmailNotificationService);

    const makeSmsServiceMock = () => ({
        queueSms: vi.fn().mockResolvedValue({ id: 'sms-123' }),
    } as unknown as SmsNotificationService);

    it('sends both email and SMS by default when both contacts are provided', async () => {
        const emailMock = makeEmailServiceMock();
        const smsMock = makeSmsServiceMock();
        const orchestrator = new NotificationService(emailMock, smsMock);

        await orchestrator.sendNotification(
            { email: 'user@test.com', phoneNumber: '+1234567890' },
            { subject: 'Hello subject', body: 'Hello body' },
            { tenantId: 't-1', branchId: 'b-2', senderName: 'BrandedName' }
        );

        expect(emailMock.queueEmail).toHaveBeenCalledWith(
            'user@test.com',
            'Hello subject',
            'Hello body',
            't-1',
            'b-2'
        );
        expect(smsMock.queueSms).toHaveBeenCalledWith(
            '+1234567890',
            'Hello body',
            't-1',
            'b-2',
            'BrandedName'
        );
    });

    it('sends only email when channels is restricted to email', async () => {
        const emailMock = makeEmailServiceMock();
        const smsMock = makeSmsServiceMock();
        const orchestrator = new NotificationService(emailMock, smsMock);

        await orchestrator.sendNotification(
            { email: 'user@test.com', phoneNumber: '+1234567890' },
            { subject: 'Hello subject', body: 'Hello body' },
            { channels: ['email'] }
        );

        expect(emailMock.queueEmail).toHaveBeenCalled();
        expect(smsMock.queueSms).not.toHaveBeenCalled();
    });

    it('sends only SMS when channels is restricted to sms', async () => {
        const emailMock = makeEmailServiceMock();
        const smsMock = makeSmsServiceMock();
        const orchestrator = new NotificationService(emailMock, smsMock);

        await orchestrator.sendNotification(
            { email: 'user@test.com', phoneNumber: '+1234567890' },
            { subject: 'Hello subject', body: 'Hello body' },
            { channels: ['sms'] }
        );

        expect(emailMock.queueEmail).not.toHaveBeenCalled();
        expect(smsMock.queueSms).toHaveBeenCalled();
    });

    it('falls back to default subject for email if none provided', async () => {
        const emailMock = makeEmailServiceMock();
        const smsMock = makeSmsServiceMock();
        const orchestrator = new NotificationService(emailMock, smsMock);

        await orchestrator.sendNotification(
            { email: 'user@test.com' },
            { body: 'Hello body' }
        );

        expect(emailMock.queueEmail).toHaveBeenCalledWith(
            'user@test.com',
            'Notification',
            'Hello body',
            undefined,
            undefined
        );
    });
});
