import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { EmailProvider } from '../../infrastructure/email/EmailProvider.js';

export class EmailNotificationService {
    public constructor(
        private readonly prisma: PrismaClient,
        private readonly provider: EmailProvider
    ) {}

    public async queueEmail(
        to: string,
        subject: string,
        body: string,
        tenantId?: string,
        branchId?: string,
        maxRetries = 3
    ) {
        if (!to) {
            throw new Error('Recipient email "to" is required.');
        }
        if (!subject) {
            throw new Error('Email subject is required.');
        }
        if (!body) {
            throw new Error('Email body is required.');
        }

        // 1. Create a PENDING EmailMessage in DB
        const emailMessage = await this.prisma.emailMessage.create({
            data: {
                to,
                subject,
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
        this.attemptDelivery(emailMessage.id).catch((err) => {
            console.error(`[EmailNotificationService] Immediate delivery attempt failed for ${emailMessage.id}:`, err);
        });

        return emailMessage;
    }

    public async attemptDelivery(id: string): Promise<void> {
        const email = await this.prisma.emailMessage.findUnique({ where: { id } });
        if (!email) return;

        // Ensure we only deliver messages that are PENDING or FAILED (with remaining retries)
        if (email.status !== 'PENDING' && email.status !== 'FAILED') {
            return;
        }

        if (email.retryCount >= email.maxRetries) {
            return;
        }

        // Increment retry count in DB first to prevent duplicate attempts in rapid succession
        await this.prisma.emailMessage.update({
            where: { id },
            data: {
                retryCount: { increment: 1 },
            },
        });

        const result = await this.provider.sendEmail(email.to, email.subject, email.body);

        if (result.success) {
            await this.prisma.emailMessage.update({
                where: { id },
                data: {
                    status: 'SENT',
                    providerMessageId: result.providerMessageId ?? null,
                    errorMessage: null,
                },
            });
        } else {
            const currentRetry = email.retryCount + 1;
            const nextRetryDelayMinutes = Math.pow(2, currentRetry - 1); // 1, 2, 4 minutes backoff
            const nextRetryAt = new Date(Date.now() + nextRetryDelayMinutes * 60 * 1000);

            const finalStatus = currentRetry >= email.maxRetries ? 'FAILED' : 'PENDING';

            await this.prisma.emailMessage.update({
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
        
        // Find PENDING emails whose nextRetryAt has arrived
        const pendingEmails = await this.prisma.emailMessage.findMany({
            where: {
                status: 'PENDING',
                nextRetryAt: { lte: now },
            },
            take: 20, // process in small batches to protect server load
        });

        if (pendingEmails.length === 0) return;

        console.log(`[EmailNotificationService] Processing ${pendingEmails.length} pending email retries...`);

        // Process in parallel with safe concurrency limits
        await Promise.allSettled(
            pendingEmails.map((email) => this.attemptDelivery(email.id))
        );
    }
}
