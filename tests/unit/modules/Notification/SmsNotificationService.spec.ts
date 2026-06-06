import { describe, expect, it, vi } from 'vitest';
import { SmsNotificationService, buildAlphaSenderId } from '../../../../src/modules/Notification/application/services/SmsNotificationService.js';
import { SmsProvider } from '../../../../src/modules/Notification/infrastructure/sms/SmsProvider.js';
import { TwilioSmsProvider } from '../../../../src/modules/Notification/infrastructure/sms/TwilioSmsProvider.js';
import { TextLkSmsProvider } from '../../../../src/modules/Notification/infrastructure/sms/TextLkSmsProvider.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeSmsPrisma = (smsRow: object) => ({
    smsMessage: {
        create: vi.fn().mockResolvedValue(smsRow),
        findUnique: vi.fn().mockResolvedValue(smsRow),
        update: vi.fn().mockResolvedValue(smsRow),
    },
});

// ---------------------------------------------------------------------------
// SmsNotificationService — core delivery tests
// ---------------------------------------------------------------------------

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
            senderName: null,
        };

        const prismaMock = makeSmsPrisma(mockSmsMessage) as any;

        const providerMock = {
            sendSms: vi.fn().mockResolvedValue({ success: true, providerMessageId: 'twilio-sid-1' }),
        } as SmsProvider;

        const service = new SmsNotificationService(prismaMock, providerMock, 'http://test-base.com');

        const attemptDeliverySpy = vi.spyOn(service, 'attemptDelivery').mockResolvedValue(undefined);

        const result = await service.queueSms('+1234567890', 'Hello TDD!', 'tenant-1', 'branch-2');

        expect(prismaMock.smsMessage.create).toHaveBeenCalledWith({
            data: {
                to: '+1234567890',
                body: 'Hello TDD!',
                status: 'PENDING',
                retryCount: 0,
                maxRetries: 3,
                nextRetryAt: expect.any(Date),
                tenantId: 'tenant-1',
                branchId: 'branch-2',
                senderName: null,
            }
        });
        expect(result.id).toBe('msg-123');
        expect(attemptDeliverySpy).toHaveBeenCalledWith('msg-123');
    });

    it('stores pre-supplied senderName in the DB record', async () => {
        const mockSmsMessage = {
            id: 'msg-sn', to: '+1234567890', body: 'Hi!',
            status: 'PENDING', retryCount: 0, maxRetries: 3,
            nextRetryAt: new Date(), tenantId: 'tenant-1', branchId: null,
            senderName: 'TechSchool',
        };
        const prismaMock = makeSmsPrisma(mockSmsMessage) as any;
        const providerMock = { sendSms: vi.fn() } as SmsProvider;

        const service = new SmsNotificationService(prismaMock, providerMock, 'http://test-base.com');
        vi.spyOn(service, 'attemptDelivery').mockResolvedValue(undefined);

        await service.queueSms('+1234567890', 'Hi!', 'tenant-1', undefined, 'TechSchool');

        expect(prismaMock.smsMessage.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ senderName: 'TechSchool' }) })
        );
    });

    it('updates status to SENT on successful provider delivery', async () => {
        const mockSms = {
            id: 'msg-1',
            to: '+1234567890',
            body: 'Hello TDD!',
            status: 'PENDING',
            retryCount: 0,
            maxRetries: 3,
            tenantId: null,
            senderName: null,
        };

        const prismaMock = makeSmsPrisma(mockSms) as any;
        const providerMock = {
            sendSms: vi.fn().mockResolvedValue({ success: true, providerMessageId: 'sid-abc' }),
        } as SmsProvider;

        const service = new SmsNotificationService(prismaMock, providerMock, 'http://test-base.com');
        await service.attemptDelivery('msg-1');

        expect(prismaMock.smsMessage.update).toHaveBeenNthCalledWith(1, {
            where: { id: 'msg-1' },
            data: { retryCount: { increment: 1 } },
        });
        expect(prismaMock.smsMessage.update).toHaveBeenNthCalledWith(2, {
            where: { id: 'msg-1' },
            data: { status: 'SENT', providerMessageId: 'sid-abc', errorMessage: null },
        });
    });

    it('handles failures by calculating exponential backoff and setting nextRetryAt', async () => {
        const mockSms = {
            id: 'msg-2', to: '+1234567890', body: 'Hello Backoff!',
            status: 'PENDING', retryCount: 1, maxRetries: 3,
            tenantId: null, senderName: null,
        };

        const prismaMock = makeSmsPrisma(mockSms) as any;
        const providerMock = {
            sendSms: vi.fn().mockResolvedValue({ success: false, error: 'Network failure' }),
        } as SmsProvider;

        const service = new SmsNotificationService(prismaMock, providerMock, 'http://test-base.com');
        await service.attemptDelivery('msg-2');

        expect(prismaMock.smsMessage.update).toHaveBeenNthCalledWith(2, {
            where: { id: 'msg-2' },
            data: {
                status: 'PENDING',
                errorMessage: 'Network failure',
                nextRetryAt: expect.any(Date),
            },
        });

        const nextRetryDate = prismaMock.smsMessage.update.mock.calls[1][0].data.nextRetryAt;
        expect(nextRetryDate.getTime()).toBeGreaterThan(Date.now() + 50 * 1000);
    });

    it('marks message as FAILED if retry limit is reached', async () => {
        const mockSms = {
            id: 'msg-3', to: '+1234567890', body: 'Hello Fail!',
            status: 'PENDING', retryCount: 2, maxRetries: 3,
            tenantId: null, senderName: null,
        };

        const prismaMock = makeSmsPrisma(mockSms) as any;
        const providerMock = {
            sendSms: vi.fn().mockResolvedValue({ success: false, error: 'Permanent fail' }),
        } as SmsProvider;

        const service = new SmsNotificationService(prismaMock, providerMock, 'http://test-base.com');
        await service.attemptDelivery('msg-3');

        expect(prismaMock.smsMessage.update).toHaveBeenNthCalledWith(2, {
            where: { id: 'msg-3' },
            data: { status: 'FAILED', errorMessage: 'Permanent fail', nextRetryAt: null },
        });
    });

    it('does not attempt delivery and queues SMS with status SKIPPED when enableSms is false', async () => {
        const mockSmsMessage = {
            id: 'msg-skipped',
            to: '+1234567890',
            body: 'Hello skipped!',
            status: 'SKIPPED',
            retryCount: 0,
            maxRetries: 3,
            nextRetryAt: null,
            tenantId: 'tenant-1',
            branchId: 'branch-2',
            senderName: null,
            errorMessage: 'SMS service is disabled by configuration (ENABLE_SMS=false)',
        };

        const prismaMock = makeSmsPrisma(mockSmsMessage) as any;
        const providerMock = {
            sendSms: vi.fn(),
        } as SmsProvider;

        const service = new SmsNotificationService(
            prismaMock,
            providerMock,
            'http://test-base.com',
            undefined,
            undefined,
            false
        );

        const attemptDeliverySpy = vi.spyOn(service, 'attemptDelivery').mockResolvedValue(undefined);

        const result = await service.queueSms('+1234567890', 'Hello skipped!', 'tenant-1', 'branch-2');

        expect(prismaMock.smsMessage.create).toHaveBeenCalledWith({
            data: {
                to: '+1234567890',
                body: 'Hello skipped!',
                status: 'SKIPPED',
                retryCount: 0,
                maxRetries: 3,
                nextRetryAt: null,
                tenantId: 'tenant-1',
                branchId: 'branch-2',
                senderName: null,
                errorMessage: 'SMS service is disabled by configuration (ENABLE_SMS=false)',
            }
        });
        expect(result.id).toBe('msg-skipped');
        expect(result.status).toBe('SKIPPED');
        expect(attemptDeliverySpy).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// SmsNotificationService — sender resolution (DIP / clean architecture)
// ---------------------------------------------------------------------------

describe('SmsNotificationService — sender resolution', () => {
    const baseSms = (overrides: object) => ({
        id: 'msg-r', to: '+94771234567', body: 'Hello!',
        status: 'PENDING', retryCount: 0, maxRetries: 3,
        tenantId: null, senderName: null,
        ...overrides,
    });

    it('Pattern 2: uses senderName stored on the message — no resolver needed', async () => {
        const sms = baseSms({ senderName: 'TechSchool' });
        const prismaMock = makeSmsPrisma(sms) as any;

        let capturedFrom: string | undefined;
        const provider: SmsProvider = {
            sendSms: vi.fn().mockImplementation(async (_t, _b, _c, from) => {
                capturedFrom = from;
                return { success: true };
            }),
        };

        const resolverSpy = { resolveNameById: vi.fn() };
        const service = new SmsNotificationService(prismaMock, provider, 'http://base.com', undefined, resolverSpy);
        await service.attemptDelivery('msg-r');

        expect(capturedFrom).toBe('TechSchool');
        // Resolver was NOT called — stored name was enough
        expect(resolverSpy.resolveNameById).not.toHaveBeenCalled();
    });

    it('Pattern 1: falls back to ITenantNameResolver when no senderName on message', async () => {
        const sms = baseSms({ tenantId: 'tenant-abc', senderName: null });
        const prismaMock = makeSmsPrisma(sms) as any;

        let capturedFrom: string | undefined;
        const provider: SmsProvider = {
            sendSms: vi.fn().mockImplementation(async (_t, _b, _c, from) => {
                capturedFrom = from;
                return { success: true };
            }),
        };

        // Resolver returns tenant name — does NOT touch prisma.tenant directly
        const resolver = { resolveNameById: vi.fn().mockResolvedValue('TechSchool') };
        const service = new SmsNotificationService(prismaMock, provider, 'http://base.com', undefined, resolver);
        await service.attemptDelivery('msg-r');

        expect(capturedFrom).toBe('TechSchool');
        expect(resolver.resolveNameById).toHaveBeenCalledWith('tenant-abc');
    });

    it('falls back to defaultSenderName when resolver returns nothing', async () => {
        const sms = baseSms({ tenantId: 'tenant-xyz', senderName: null });
        const prismaMock = makeSmsPrisma(sms) as any;

        let capturedFrom: string | undefined;
        const provider: SmsProvider = {
            sendSms: vi.fn().mockImplementation(async (_t, _b, _c, from) => {
                capturedFrom = from;
                return { success: true };
            }),
        };

        const resolver = { resolveNameById: vi.fn().mockResolvedValue(undefined) };
        const service = new SmsNotificationService(prismaMock, provider, 'http://base.com', 'DSMS', resolver);
        await service.attemptDelivery('msg-r');

        expect(capturedFrom).toBe('DSMS');
    });

    it('falls back to defaultSenderName when resolver throws', async () => {
        const sms = baseSms({ tenantId: 'bad-tenant', senderName: null });
        const prismaMock = makeSmsPrisma(sms) as any;

        let capturedFrom: string | undefined;
        const provider: SmsProvider = {
            sendSms: vi.fn().mockImplementation(async (_t, _b, _c, from) => {
                capturedFrom = from;
                return { success: true };
            }),
        };

        const resolver = { resolveNameById: vi.fn().mockRejectedValue(new Error('DB down')) };
        const service = new SmsNotificationService(prismaMock, provider, 'http://base.com', 'DSMS', resolver);
        await service.attemptDelivery('msg-r');

        expect(capturedFrom).toBe('DSMS');
    });

    it('sanitises special characters in tenant names for alpha sender ID', async () => {
        const sms = baseSms({ senderName: 'Alpha & Test Co.' });
        const prismaMock = makeSmsPrisma(sms) as any;

        let capturedFrom: string | undefined;
        const provider: SmsProvider = {
            sendSms: vi.fn().mockImplementation(async (_t, _b, _c, from) => {
                capturedFrom = from;
                return { success: true };
            }),
        };

        const service = new SmsNotificationService(prismaMock, provider, 'http://base.com');
        await service.attemptDelivery('msg-r');

        // "Alpha & Test Co." → strip non-alnum → "AlphaTestCo" (11 chars)
        expect(capturedFrom).toBe('AlphaTestCo');
    });
});

// ---------------------------------------------------------------------------
// buildAlphaSenderId — pure unit tests
// ---------------------------------------------------------------------------

describe('buildAlphaSenderId', () => {
    it('returns name unchanged when already valid', () => {
        expect(buildAlphaSenderId('TechSchool')).toBe('TechSchool');
    });

    it('strips special characters and spaces', () => {
        expect(buildAlphaSenderId('Alpha & Test Co.')).toBe('AlphaTestCo');
    });

    it('truncates to 11 characters', () => {
        expect(buildAlphaSenderId('Bright Future Academy')).toBe('BrightFutur');
    });

    it('returns undefined for pure-numeric names', () => {
        expect(buildAlphaSenderId('12345')).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
        expect(buildAlphaSenderId('')).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// TwilioSmsProvider — alphanumeric sender ID (provider-level tests)
// ---------------------------------------------------------------------------

describe('TwilioSmsProvider — Alphanumeric Sender ID', () => {
    const BASE_CONFIG = {
        accountSid: 'ACtest',
        authToken: 'token123',
        fromNumber: '+17016582160',
    };

    it('uses per-call fromOverride with highest priority', async () => {
        let capturedBody: URLSearchParams | null = null;

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
            capturedBody = new URLSearchParams(init?.body as string);
            return new Response(JSON.stringify({ sid: 'SM_override' }), { status: 201 });
        });

        const provider = new TwilioSmsProvider({ ...BASE_CONFIG, alphaId: 'SystemAlpha' });
        await provider.sendSms('+94771234567', 'Hello!', undefined, 'TenantName');

        // fromOverride beats configured alphaId
        expect(capturedBody!.get('From')).toBe('TenantName');
        fetchSpy.mockRestore();
    });

    it('uses alphaId as From when configured and no override', async () => {
        let capturedBody: URLSearchParams | null = null;

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
            capturedBody = new URLSearchParams(init?.body as string);
            return new Response(JSON.stringify({ sid: 'SM_alpha_test' }), { status: 201 });
        });

        const provider = new TwilioSmsProvider({ ...BASE_CONFIG, alphaId: 'DSMS' });
        const result = await provider.sendSms('+94771234567', 'Hello from DSMS!');

        expect(result.success).toBe(true);
        expect(capturedBody!.get('From')).toBe('DSMS');
        expect(capturedBody!.get('To')).toBe('+94771234567');
        fetchSpy.mockRestore();
    });

    it('falls back to fromNumber when alphaId is not set', async () => {
        let capturedBody: URLSearchParams | null = null;

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
            capturedBody = new URLSearchParams(init?.body as string);
            return new Response(JSON.stringify({ sid: 'SM_phone_test' }), { status: 201 });
        });

        const provider = new TwilioSmsProvider({ ...BASE_CONFIG });
        const result = await provider.sendSms('+94771234567', 'Hello from number!');

        expect(result.success).toBe(true);
        expect(capturedBody!.get('From')).toBe('+17016582160');
        fetchSpy.mockRestore();
    });

    it('falls back to fromNumber when alphaId is an empty string', async () => {
        let capturedBody: URLSearchParams | null = null;

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
            capturedBody = new URLSearchParams(init?.body as string);
            return new Response(JSON.stringify({ sid: 'SM_empty_alpha' }), { status: 201 });
        });

        const provider = new TwilioSmsProvider({ ...BASE_CONFIG, alphaId: '' });
        const result = await provider.sendSms('+94771234567', 'Hello!');

        expect(result.success).toBe(true);
        expect(capturedBody!.get('From')).toBe('+17016582160');
        fetchSpy.mockRestore();
    });

    it('automatically falls back to fromNumber when Twilio returns trial account or unsupported alphanumeric sender error', async () => {
        const fetchCalls: { url: string; body: URLSearchParams }[] = [];

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
            fetchCalls.push({
                url: url as string,
                body: new URLSearchParams(init?.body as string),
            });

            if (fetchCalls.length === 1) {
                // First call: Simulate Alphanumeric sender error on trial account (error 21614)
                return new Response(
                    JSON.stringify({
                        code: 21614,
                        message: "Alphanumeric Sender ID cannot be used as the 'From' number on trial accounts: SadeeshaLer",
                    }),
                    { status: 400 }
                );
            } else {
                // Second call: Fallback success
                return new Response(JSON.stringify({ sid: 'SM_fallback_success' }), { status: 201 });
            }
        });

        // Suppress warning log in test output
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const provider = new TwilioSmsProvider({ ...BASE_CONFIG, alphaId: 'SadeeshaLer' });
        const result = await provider.sendSms('+94727722924', 'Hello test!');

        expect(result.success).toBe(true);
        expect(result.providerMessageId).toBe('SM_fallback_success');
        expect(fetchCalls).toHaveLength(2);
        
        // Verifying first call attempted alphanumeric ID
        expect(fetchCalls[0].body.get('From')).toBe('SadeeshaLer');
        
        // Verifying second call fell back to default phone number
        expect(fetchCalls[1].body.get('From')).toBe('+17016582160');

        fetchSpy.mockRestore();
        warnSpy.mockRestore();
    });

    it('returns combined error message if both alphanumeric sender and fallback phone number fail', async () => {
        const fetchCalls: { url: string; body: URLSearchParams }[] = [];

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
            fetchCalls.push({
                url: url as string,
                body: new URLSearchParams(init?.body as string),
            });

            if (fetchCalls.length === 1) {
                return new Response(
                    JSON.stringify({
                        code: 21614,
                        message: "Alphanumeric Sender ID cannot be used as the 'From' number on trial accounts: SadeeshaLer",
                    }),
                    { status: 400 }
                );
            } else {
                // Second call: Fallback also fails (e.g. invalid to number)
                return new Response(
                    JSON.stringify({
                        code: 21211,
                        message: "The 'To' number is not a valid phone number.",
                    }),
                    { status: 400 }
                );
            }
        });

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const provider = new TwilioSmsProvider({ ...BASE_CONFIG, alphaId: 'SadeeshaLer' });
        const result = await provider.sendSms('invalid-number', 'Hello test!');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Alphanumeric Sender ID failed');
        expect(result.error).toContain('fallback phone number also failed');
        expect(fetchCalls).toHaveLength(2);

        fetchSpy.mockRestore();
        warnSpy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// TextLkSmsProvider — Sri Lanka SMS gateway (provider-level tests)
// ---------------------------------------------------------------------------

describe('TextLkSmsProvider', () => {
    const BASE_CONFIG = {
        apiToken: 'test-token',
        defaultSenderId: 'TextLKDemo',
    };

    it('sends SMS successfully, sanitizing the recipient number by removing leading "+"', async () => {
        let capturedUrl: string | null = null;
        let capturedHeaders: HeadersInit | null = null;
        let capturedBody: any = null;

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
            capturedUrl = url as string;
            capturedHeaders = init?.headers || null;
            capturedBody = JSON.parse(init?.body as string);
            return new Response(
                JSON.stringify({
                    status: 'success',
                    data: {
                        uid: '606812e63f78b',
                        recipient: '94771234567',
                        message: 'Hello Text.lk!',
                    },
                }),
                { status: 200 }
            );
        });

        const provider = new TextLkSmsProvider(BASE_CONFIG);
        const result = await provider.sendSms('+94771234567', 'Hello Text.lk!');

        expect(result.success).toBe(true);
        expect(result.providerMessageId).toBe('606812e63f78b');
        expect(capturedUrl).toBe('https://app.text.lk/api/v3/sms/send');
        expect(capturedHeaders).toMatchObject({
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        });
        expect(capturedBody).toEqual({
            recipient: '94771234567', // "+" stripped
            sender_id: 'TextLKDemo',
            type: 'plain',
            message: 'Hello Text.lk!',
        });

        fetchSpy.mockRestore();
    });

    it('uses fromOverride instead of defaultSenderId when supplied', async () => {
        let capturedBody: any = null;

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
            capturedBody = JSON.parse(init?.body as string);
            return new Response(JSON.stringify({ status: 'success', data: 'ok' }), { status: 200 });
        });

        const provider = new TextLkSmsProvider(BASE_CONFIG);
        await provider.sendSms('94771234567', 'Hello!', undefined, 'MySender');

        expect(capturedBody.sender_id).toBe('MySender');
        fetchSpy.mockRestore();
    });

    it('returns success: false with provider error message on failure response', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
            return new Response(
                JSON.stringify({
                    status: 'error',
                    message: 'Insufficient balance.',
                }),
                { status: 400 }
            );
        });

        const provider = new TextLkSmsProvider(BASE_CONFIG);
        const result = await provider.sendSms('94771234567', 'Hello!');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Insufficient balance.');
        fetchSpy.mockRestore();
    });

    it('returns success: false when required config is missing', async () => {
        const provider = new TextLkSmsProvider({ apiToken: '', defaultSenderId: '' });
        const result = await provider.sendSms('94771234567', 'Hello!');

        expect(result.success).toBe(false);
        expect(result.error).toContain('provider is not properly configured');
    });
});


