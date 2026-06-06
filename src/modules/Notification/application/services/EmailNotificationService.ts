import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { EmailProvider } from '../../infrastructure/email/EmailProvider.js';

export class EmailNotificationService {
    public constructor(
        private readonly prisma: PrismaClient,
        private readonly provider: EmailProvider,
        private readonly enableEmail = true,
        private readonly defaultEmailService?: string,
        private readonly defaultSenderName?: string
    ) {}

    public wrapInHtmlTemplate(body: string, systemName?: string): string {
        const brandName = systemName || this.defaultSenderName || 'WEBBLAB';
        const formattedBody = body.includes('<') && body.includes('>') 
            ? body 
            : body.replace(/\n/g, '<br />');

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${brandName} Notification</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #f8fafc;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            padding: 20px;
        }
        .card {
            background-color: #ffffff;
            border-radius: 16px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
            border: 1px solid #f1f5f9;
            overflow: hidden;
        }
        .header-gradient {
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            padding: 32px 24px;
            text-align: center;
            border-bottom: 3px solid #06b6d4;
        }
        .brand-title {
            color: #ffffff;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.025em;
            margin: 0;
            text-transform: uppercase;
        }
        .brand-subtitle {
            color: #94a3b8;
            font-size: 13px;
            margin-top: 4px;
            margin-bottom: 0;
            letter-spacing: 0.05em;
        }
        .content {
            padding: 40px 32px;
            color: #334155;
            line-height: 1.625;
            font-size: 15px;
        }
        .footer {
            text-align: center;
            padding: 24px;
            background-color: #f8fafc;
            border-top: 1px solid #f1f5f9;
        }
        .footer-text {
            color: #64748b;
            font-size: 12px;
            margin: 0 0 8px 0;
        }
        .footer-subtext {
            color: #94a3b8;
            font-size: 11px;
            margin: 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header-gradient">
                <h1 class="brand-title">${brandName}</h1>
                <p class="brand-subtitle">SECURE NOTIFICATION ENGINE</p>
            </div>
            <div class="content">
                ${formattedBody}
            </div>
            <div class="footer">
                <p class="footer-text">This is an automated system notification from ${brandName}.</p>
                <p class="footer-subtext">&copy; ${new Date().getFullYear()} ${brandName}. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

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

        const wrappedBody = this.wrapInHtmlTemplate(body);

        if (!this.enableEmail) {
            console.log(`[EmailNotificationService] Email service is disabled (ENABLE_EMAIL=false). Skipping queueing/sending for ${to}.`);
            const emailMessage = await this.prisma.emailMessage.create({
                data: {
                    to,
                    subject,
                    body: wrappedBody,
                    status: 'SKIPPED',
                    retryCount: 0,
                    maxRetries,
                    nextRetryAt: null,
                    tenantId: tenantId ?? null,
                    branchId: branchId ?? null,
                    errorMessage: 'Email service is disabled by configuration (ENABLE_EMAIL=false)',
                },
            });
            return emailMessage;
        }

        // 1. Create a PENDING EmailMessage in DB
        const emailMessage = await this.prisma.emailMessage.create({
            data: {
                to,
                subject,
                body: wrappedBody,
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
