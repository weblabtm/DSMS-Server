import { describe, expect, it, vi } from 'vitest';
import { SmsNotificationService } from '../../../../src/modules/Notification/application/services/SmsNotificationService.js';
import { SmsProvider } from '../../../../src/modules/Notification/infrastructure/sms/SmsProvider.js';

describe('SmsNotificationService', () => {
    it('queues an SMS message correctly in the database and calls attemptDelivery', async () => {
        const mockSmsMessage = {
            id: 'msg-123',
            to: '+1234567890',
            body: 'Hello TDD!',
            status: 'PENDING',
            retryCount: 0,
            maxRetries: 3,
            nextRetryAt: new Date(),
            tenantId: 'tenant-1',
            branchId: 'branch-2',
        };

        const createMock = vi.fn().mockResolvedValue(mockSmsMessage);
        const findUniqueMock = vi.fn().mockResolvedValue(mockSmsMessage);
        const updateMock = vi.fn().mockResolvedValue(mockSmsMessage);

        const prismaMock = {
            smsMessage: {
                create: createMock,
                findUnique: findUniqueMock,
                update: updateMock,
            }
        } as any;

        const providerMock = {
            sendSms: vi.fn().mockResolvedValue({ success: true, providerMessageId: 'twilio-sid-1' }),
        } as SmsProvider;

        const service = new SmsNotificationService(prismaMock, providerMock, 'http://test-base.com');
        
        // Spy on attemptDelivery
        const attemptDeliverySpy = vi.spyOn(service, 'attemptDelivery').mockResolvedValue(undefined);

        const result = await service.queueSms('+1234567890', 'Hello TDD!', 'tenant-1', 'branch-2');

        expect(createMock).toHaveBeenCalledWith({
            data: {
                to: '+1234567890',
                body: 'Hello TDD!',
                status: 'PENDING',
                retryCount: 0,
                maxRetries: 3,
                nextRetryAt: expect.any(Date),
                tenantId: 'tenant-1',
                branchId: 'branch-2',
            }
        });
        expect(result.id).toBe('msg-123');
        expect(attemptDeliverySpy).toHaveBeenCalledWith('msg-123');
    });

    it('updates status to SENT on successful provider delivery', async () => {
        const mockSms = {
            id: 'msg-1',
            to: '+1234567890',
            body: 'Hello TDD!',
            status: 'PENDING',
            retryCount: 0,
            maxRetries: 3,
        };

        const findUniqueMock = vi.fn().mockResolvedValue(mockSms);
        const updateMock = vi.fn().mockResolvedValue(mockSms);

        const prismaMock = {
            smsMessage: {
                findUnique: findUniqueMock,
                update: updateMock,
            }
        } as any;

        const providerMock = {
            sendSms: vi.fn().mockResolvedValue({ success: true, providerMessageId: 'sid-abc' }),
        } as SmsProvider;

        const service = new SmsNotificationService(prismaMock, providerMock, 'http://test-base.com');
        await service.attemptDelivery('msg-1');

        expect(findUniqueMock).toHaveBeenCalledWith({ where: { id: 'msg-1' } });
        // The first update increments retryCount
        expect(updateMock).toHaveBeenNthCalledWith(1, {
            where: { id: 'msg-1' },
            data: { retryCount: { increment: 1 } },
        });
        // The second update sets status to SENT
        expect(updateMock).toHaveBeenNthCalledWith(2, {
            where: { id: 'msg-1' },
            data: {
                status: 'SENT',
                providerMessageId: 'sid-abc',
                errorMessage: null,
            },
        });
    });

    it('handles failures by calculating exponential backoff and setting nextRetryAt', async () => {
        const mockSms = {
            id: 'msg-2',
            to: '+1234567890',
            body: 'Hello Backoff!',
            status: 'PENDING',
            retryCount: 1, // Already attempted once
            maxRetries: 3,
        };

        const findUniqueMock = vi.fn().mockResolvedValue(mockSms);
        const updateMock = vi.fn().mockResolvedValue(mockSms);

        const prismaMock = {
            smsMessage: {
                findUnique: findUniqueMock,
                update: updateMock,
            }
        } as any;

        const providerMock = {
            sendSms: vi.fn().mockResolvedValue({ success: false, error: 'Network failure' }),
        } as SmsProvider;

        const service = new SmsNotificationService(prismaMock, providerMock, 'http://test-base.com');
        await service.attemptDelivery('msg-2');

        // First update increments retryCount
        expect(updateMock).toHaveBeenNthCalledWith(1, {
            where: { id: 'msg-2' },
            data: { retryCount: { increment: 1 } },
        });

        // Second update schedules next attempt with exponential backoff:
        // currentRetry = retryCount + 1 = 2
        // backoff = 2^(2-1) = 2 minutes
        expect(updateMock).toHaveBeenNthCalledWith(2, {
            where: { id: 'msg-2' },
            data: {
                status: 'PENDING', // Still pending because retryCount < maxRetries
                errorMessage: 'Network failure',
                nextRetryAt: expect.any(Date),
            },
        });

        // Let's verify nextRetryAt is in the future
        const lastCallArgs = updateMock.mock.calls[1][0].data;
        const nextRetryDate = lastCallArgs.nextRetryAt;
        expect(nextRetryDate.getTime()).toBeGreaterThan(Date.now() + 50 * 1000); // at least ~1 min in future
    });

    it('marks message as FAILED if retry limit is reached', async () => {
        const mockSms = {
            id: 'msg-3',
            to: '+1234567890',
            body: 'Hello Fail!',
            status: 'PENDING',
            retryCount: 2, // Tried 2 times, current try will be 3
            maxRetries: 3,
        };

        const findUniqueMock = vi.fn().mockResolvedValue(mockSms);
        const updateMock = vi.fn().mockResolvedValue(mockSms);

        const prismaMock = {
            smsMessage: {
                findUnique: findUniqueMock,
                update: updateMock,
            }
        } as any;

        const providerMock = {
            sendSms: vi.fn().mockResolvedValue({ success: false, error: 'Permanent fail' }),
        } as SmsProvider;

        const service = new SmsNotificationService(prismaMock, providerMock, 'http://test-base.com');
        await service.attemptDelivery('msg-3');

        expect(updateMock).toHaveBeenNthCalledWith(2, {
            where: { id: 'msg-3' },
            data: {
                status: 'FAILED', // Max retries exceeded (3 >= 3)
                errorMessage: 'Permanent fail',
                nextRetryAt: null,
            },
        });
    });
});
