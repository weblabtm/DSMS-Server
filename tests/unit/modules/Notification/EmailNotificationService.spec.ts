import { describe, expect, it, vi } from 'vitest';
import { EmailNotificationService } from '../../../../src/modules/Notification/application/services/EmailNotificationService.js';
import { EmailProvider } from '../../../../src/modules/Notification/infrastructure/email/EmailProvider.js';

describe('EmailNotificationService', () => {
    it('queues an Email message correctly in the database and calls attemptDelivery', async () => {
        const mockEmailMessage = {
            id: 'msg-123',
            to: 'test@email.com',
            subject: 'Test Subject',
            body: 'Hello TDD!',
            status: 'PENDING',
            retryCount: 0,
            maxRetries: 3,
            nextRetryAt: new Date(),
            tenantId: 'tenant-1',
            branchId: 'branch-2',
        };

        const createMock = vi.fn().mockResolvedValue(mockEmailMessage);
        const findUniqueMock = vi.fn().mockResolvedValue(mockEmailMessage);
        const updateMock = vi.fn().mockResolvedValue(mockEmailMessage);

        const prismaMock = {
            emailMessage: {
                create: createMock,
                findUnique: findUniqueMock,
                update: updateMock,
            }
        } as any;

        const providerMock = {
            sendEmail: vi.fn().mockResolvedValue({ success: true, providerMessageId: 'sg-sid-1' }),
        } as EmailProvider;

        const service = new EmailNotificationService(prismaMock, providerMock, true, 'console', 'WEBBLAB');
        
        // Spy on attemptDelivery
        const attemptDeliverySpy = vi.spyOn(service, 'attemptDelivery').mockResolvedValue(undefined);

        const result = await service.queueEmail('test@email.com', 'Test Subject', 'Hello TDD!', 'tenant-1', 'branch-2');

        expect(createMock).toHaveBeenCalledWith({
            data: {
                to: 'test@email.com',
                subject: 'Test Subject',
                body: expect.stringContaining('Hello TDD!'),
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
        const mockEmail = {
            id: 'msg-1',
            to: 'test@email.com',
            subject: 'Subject',
            body: 'Body',
            status: 'PENDING',
            retryCount: 0,
            maxRetries: 3,
        };

        const findUniqueMock = vi.fn().mockResolvedValue(mockEmail);
        const updateMock = vi.fn().mockResolvedValue(mockEmail);

        const prismaMock = {
            emailMessage: {
                findUnique: findUniqueMock,
                update: updateMock,
            }
        } as any;

        const providerMock = {
            sendEmail: vi.fn().mockResolvedValue({ success: true, providerMessageId: 'sg-abc' }),
        } as EmailProvider;

        const service = new EmailNotificationService(prismaMock, providerMock);
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
                providerMessageId: 'sg-abc',
                errorMessage: null,
            },
        });
    });

    it('handles failures by calculating exponential backoff and setting nextRetryAt', async () => {
        const mockEmail = {
            id: 'msg-2',
            to: 'test@email.com',
            subject: 'Subject',
            body: 'Body',
            status: 'PENDING',
            retryCount: 1, // Already attempted once
            maxRetries: 3,
        };

        const findUniqueMock = vi.fn().mockResolvedValue(mockEmail);
        const updateMock = vi.fn().mockResolvedValue(mockEmail);

        const prismaMock = {
            emailMessage: {
                findUnique: findUniqueMock,
                update: updateMock,
            }
        } as any;

        const providerMock = {
            sendEmail: vi.fn().mockResolvedValue({ success: false, error: 'SendGrid Timeout' }),
        } as EmailProvider;

        const service = new EmailNotificationService(prismaMock, providerMock);
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
                status: 'PENDING',
                errorMessage: 'SendGrid Timeout',
                nextRetryAt: expect.any(Date),
            },
        });

        const lastCallArgs = updateMock.mock.calls[1][0].data;
        const nextRetryDate = lastCallArgs.nextRetryAt;
        expect(nextRetryDate.getTime()).toBeGreaterThan(Date.now() + 50 * 1000);
    });

    it('marks message as FAILED if retry limit is reached', async () => {
        const mockEmail = {
            id: 'msg-3',
            to: 'test@email.com',
            subject: 'Subject',
            body: 'Body',
            status: 'PENDING',
            retryCount: 2, // Tried 2 times, current try will be 3
            maxRetries: 3,
        };

        const findUniqueMock = vi.fn().mockResolvedValue(mockEmail);
        const updateMock = vi.fn().mockResolvedValue(mockEmail);

        const prismaMock = {
            emailMessage: {
                findUnique: findUniqueMock,
                update: updateMock,
            }
        } as any;

        const providerMock = {
            sendEmail: vi.fn().mockResolvedValue({ success: false, error: 'SendGrid Blocked' }),
        } as EmailProvider;

        const service = new EmailNotificationService(prismaMock, providerMock);
        await service.attemptDelivery('msg-3');

        expect(updateMock).toHaveBeenNthCalledWith(2, {
            where: { id: 'msg-3' },
            data: {
                status: 'FAILED',
                errorMessage: 'SendGrid Blocked',
                nextRetryAt: null,
            },
        });
    });

    it('skips queuing and writes SKIPPED status when enableEmail is false', async () => {
        const mockEmailMessage = {
            id: 'msg-skipped',
            to: 'skipped@email.com',
            subject: 'Skipped Subject',
            body: 'Hello Skiped!',
            status: 'SKIPPED',
            retryCount: 0,
            maxRetries: 3,
            nextRetryAt: null,
            tenantId: 'tenant-1',
            branchId: 'branch-2',
        };

        const createMock = vi.fn().mockResolvedValue(mockEmailMessage);
        const prismaMock = {
            emailMessage: {
                create: createMock,
            }
        } as any;

        const providerMock = {
            sendEmail: vi.fn(),
        } as EmailProvider;

        const service = new EmailNotificationService(prismaMock, providerMock, false, 'console', 'WEBBLAB');
        const attemptDeliverySpy = vi.spyOn(service, 'attemptDelivery');

        const result = await service.queueEmail('skipped@email.com', 'Skipped Subject', 'Hello Skiped!', 'tenant-1', 'branch-2');

        expect(createMock).toHaveBeenCalledWith({
            data: {
                to: 'skipped@email.com',
                subject: 'Skipped Subject',
                body: expect.stringContaining('Hello Skiped!'),
                status: 'SKIPPED',
                retryCount: 0,
                maxRetries: 3,
                nextRetryAt: null,
                tenantId: 'tenant-1',
                branchId: 'branch-2',
                errorMessage: 'Email service is disabled by configuration (ENABLE_EMAIL=false)',
            }
        });
        expect(result.status).toBe('SKIPPED');
        expect(attemptDeliverySpy).not.toHaveBeenCalled();
    });

    it('wraps email body in a premium HSL/CSS styled HTML template structure', () => {
        const service = new EmailNotificationService({} as any, {} as any, true, 'console', 'TESTBRAND');
        const html = service.wrapInHtmlTemplate('This is a test notification body.');

        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('TESTBRAND');
        expect(html).toContain('This is a test notification body.');
        expect(html).toContain('SECURE NOTIFICATION ENGINE');
        expect(html).toContain('font-family: \'Inter\'');
    });
});
