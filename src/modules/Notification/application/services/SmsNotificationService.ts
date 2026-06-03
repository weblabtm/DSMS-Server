import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { SmsProvider } from '../../infrastructure/sms/SmsProvider.js';

export class SmsNotificationService {
    public constructor(
        private readonly prisma: PrismaClient,
        private readonly provider: SmsProvider,
        private readonly callbackBaseUrl: string
    ) {}

    public async queueSms(
        to: string,
        body: string,
        tenantId?: string,
        branchId?: string,
        maxRetries = 3
    ) {
        if (!to) {
            throw new Error('Recipient number "to" is required.');
        }
        if (!body) {
            throw new Error('Message body is required.');
        }

        // 1. Create a PENDING SmsMessage in DB
        const smsMessage = await this.prisma.smsMessage.create({
            data: {
                to,
                body,
                status: 'PENDING',
                retryCount: 0,
                maxRetries,
                nextRetryAt: new Date(),
                tenantId: tenantId ?? null,
                branchId: branchId ?? null,
            },
        });

        // 2. Attempt immediate delivery asynchronously
        this.attemptDelivery(smsMessage.id).catch((err) => {
            console.error(`[SmsNotificationService] Immediate delivery attempt failed for ${smsMessage.id}:`, err);
        });

        return smsMessage;
    }

    public async attemptDelivery(id: string): Promise<void> {
        const sms = await this.prisma.smsMessage.findUnique({ where: { id } });
        if (!sms) return;

        // Ensure we only deliver messages that are PENDING or FAILED (with remaining retries)
        if (sms.status !== 'PENDING' && sms.status !== 'FAILED') {
            return;
        }

        if (sms.retryCount >= sms.maxRetries) {
            return;
        }

        const callbackUrl = `${this.callbackBaseUrl}/notifications/sms/callback`;

        // Increment retry count in DB first to prevent duplicate attempts in rapid succession
        await this.prisma.smsMessage.update({
            where: { id },
            data: {
                retryCount: { increment: 1 },
            },
        });

        const result = await this.provider.sendSms(sms.to, sms.body, callbackUrl);

        if (result.success) {
            await this.prisma.smsMessage.update({
                where: { id },
                data: {
                    status: 'SENT',
                    providerMessageId: result.providerMessageId ?? null,
                    errorMessage: null,
                },
            });
        } else {
            const currentRetry = sms.retryCount + 1;
            const nextRetryDelayMinutes = Math.pow(2, currentRetry - 1); // 1, 2, 4 minutes backoff
            const nextRetryAt = new Date(Date.now() + nextRetryDelayMinutes * 60 * 1000);

            const finalStatus = currentRetry >= sms.maxRetries ? 'FAILED' : 'PENDING';

            await this.prisma.smsMessage.update({
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
        
        // Find PENDING messages whose nextRetryAt has arrived
        const pendingSms = await this.prisma.smsMessage.findMany({
            where: {
                status: 'PENDING',
                nextRetryAt: { lte: now },
            },
            take: 20, // process in small batches to protect server load
        });

        if (pendingSms.length === 0) return;

        console.log(`[SmsNotificationService] Processing ${pendingSms.length} pending SMS retries...`);

        // Process in parallel with safe concurrency limits
        await Promise.allSettled(
            pendingSms.map((sms) => this.attemptDelivery(sms.id))
        );
    }
}
