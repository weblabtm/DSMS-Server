import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { SmsProvider } from '../../infrastructure/sms/SmsProvider.js';
import type { ITenantNameResolver } from './ITenantNameResolver.js';

/**
 * Sanitises a display name for use as a Twilio Alphanumeric Sender ID.
 * Rules: letters & digits only, max 11 characters, must contain at least one letter.
 */
export function buildAlphaSenderId(name: string): string | undefined {
    const sanitised = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 11);
    if (sanitised.length === 0 || !/[A-Za-z]/.test(sanitised)) return undefined;
    return sanitised;
}

export class SmsNotificationService {
    public constructor(
        private readonly prisma: PrismaClient,
        private readonly provider: SmsProvider,
        private readonly callbackBaseUrl: string,
        /**
         * System-level fallback alphanumeric sender ID (from TWILIO_ALPHA_SENDER env var).
         * Used when neither the caller nor the resolver provides a name.
         */
        private readonly defaultAlphaSender?: string,
        /**
         * Optional resolver injected at composition root (app.ts).
         * Implements ITenantNameResolver — usually a thin adapter over TenantService.
         * When provided, used as a fallback if the caller did not supply a senderName.
         */
        private readonly tenantNameResolver?: ITenantNameResolver
    ) {}

    /**
     * Queues an SMS for delivery.
     *
     * @param to          Recipient phone number
     * @param body        Message body
     * @param tenantId    Tenant identifier (id or slug) — used for DB lookup if senderName not supplied
     * @param branchId    Branch identifier (optional, stored for auditing)
     * @param senderName  Pre-resolved tenant display name from the caller (Pattern 2).
     *                    When provided, no DB lookup is performed.
     */
    public async queueSms(
        to: string,
        body: string,
        tenantId?: string,
        branchId?: string,
        senderName?: string,
        maxRetries = 3
    ) {
        if (!to) throw new Error('Recipient number "to" is required.');
        if (!body) throw new Error('Message body is required.');

        const smsMessage = await (this.prisma as any).smsMessage.create({
            data: {
                to,
                body,
                status: 'PENDING',
                retryCount: 0,
                maxRetries,
                nextRetryAt: new Date(),
                tenantId: tenantId ?? null,
                branchId: branchId ?? null,
                // Store the pre-resolved sender name so retries use the same sender
                senderName: senderName ?? null,
            },
        });

        this.attemptDelivery(smsMessage.id).catch((err) => {
            console.error(`[SmsNotificationService] Immediate delivery attempt failed for ${smsMessage.id}:`, err);
        });

        return smsMessage;
    }

    public async attemptDelivery(id: string): Promise<void> {
        const sms = await (this.prisma as any).smsMessage.findUnique({ where: { id } });
        if (!sms) return;

        if (sms.status !== 'PENDING' && sms.status !== 'FAILED') return;
        if (sms.retryCount >= sms.maxRetries) return;

        const callbackUrl = `${this.callbackBaseUrl}/notifications/sms/callback`;

        // Resolve sender — priority order:
        //   1. senderName stored on the message  (supplied by caller at queue time)
        //   2. ITenantNameResolver               (adapter over TenantService — never imports it directly)
        //   3. defaultAlphaSender env var         (system-level fallback)
        //   4. undefined                          (provider falls back to its configured phone number)
        const fromOverride = await this.resolveSenderName(sms.senderName, sms.tenantId);

        await (this.prisma as any).smsMessage.update({
            where: { id },
            data: { retryCount: { increment: 1 } },
        });

        const result = await this.provider.sendSms(sms.to, sms.body, callbackUrl, fromOverride);

        if (result.success) {
            await (this.prisma as any).smsMessage.update({
                where: { id },
                data: {
                    status: 'SENT',
                    providerMessageId: result.providerMessageId ?? null,
                    errorMessage: null,
                },
            });
        } else {
            const currentRetry = sms.retryCount + 1;
            const backoffMinutes = Math.pow(2, currentRetry - 1);
            const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
            const finalStatus = currentRetry >= sms.maxRetries ? 'FAILED' : 'PENDING';

            await (this.prisma as any).smsMessage.update({
                where: { id },
                data: {
                    status: finalStatus,
                    errorMessage: result.error ?? 'Unknown error',
                    nextRetryAt: finalStatus === 'PENDING' ? nextRetryAt : null,
                },
            });
        }
    }

    public async processPendingRetries(): Promise<void> {
        const now = new Date();
        const pendingSms = await (this.prisma as any).smsMessage.findMany({
            where: { status: 'PENDING', nextRetryAt: { lte: now } },
            take: 20,
        });

        if (pendingSms.length === 0) return;

        console.log(`[SmsNotificationService] Processing ${pendingSms.length} pending SMS retries...`);

        await Promise.allSettled(
            pendingSms.map((sms: { id: string }) => this.attemptDelivery(sms.id))
        );
    }

    /**
     * Resolves the alphanumeric sender ID for a message.
     *
     * The Notification module has NO direct knowledge of TenantService or Prisma.tenant.
     * It depends only on the ITenantNameResolver interface (which it owns).
     */
    private async resolveSenderName(
        storedSenderName?: string | null,
        tenantId?: string | null
    ): Promise<string | undefined> {
        // Pattern 2: caller supplied the name at queue time — use it directly, no lookup needed
        if (storedSenderName) {
            const alpha = buildAlphaSenderId(storedSenderName);
            if (alpha) return alpha;
        }

        // Pattern 1: use the injected resolver (adapter over TenantService)
        if (tenantId && this.tenantNameResolver) {
            try {
                const name = await this.tenantNameResolver.resolveNameById(tenantId);
                if (name) {
                    const alpha = buildAlphaSenderId(name);
                    if (alpha) return alpha;
                    console.warn(`[SmsNotificationService] Tenant name "${name}" could not be sanitised into a valid alpha sender.`);
                }
            } catch (err) {
                console.warn('[SmsNotificationService] ITenantNameResolver failed, using system default:', err);
            }
        }

        // System-level fallback (TWILIO_ALPHA_SENDER env var)
        return this.defaultAlphaSender?.trim() || undefined;
    }
}
