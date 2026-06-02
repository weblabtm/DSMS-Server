import type { Request, Response } from 'express';
import { SmsNotificationService } from '../../application/services/SmsNotificationService.js';
import { isValidTwilioSignature } from '../../infrastructure/sms/verifyTwilioSignature.js';

export class SmsNotificationController {
    public constructor(
        private readonly smsService: SmsNotificationService,
        private readonly twilioAuthToken: string,
        private readonly validateSignature: boolean,
        private readonly callbackBaseUrl: string
    ) {}

    // POST /notifications/sms/send
    public async sendSms(request: Request, response: Response): Promise<void> {
        try {
            const { to, body, tenantId, branchId } = request.body;

            if (!to || !body) {
                response.status(400).json({ message: 'Missing fields: "to" and "body" are required.' });
                return;
            }

            const message = await this.smsService.queueSms(to, body, tenantId, branchId);
            response.status(202).json({
                message: 'SMS queued for delivery',
                smsId: message.id,
                status: message.status,
            });
        } catch (error) {
            response.status(500).json({
                message: 'Failed to send SMS',
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    // POST /notifications/sms/callback
    public async handleCallback(request: Request, response: Response): Promise<void> {
        try {
            const signature = request.headers['x-twilio-signature'] as string | undefined;
            const params = request.body;

            if (this.validateSignature && this.twilioAuthToken) {
                const fullUrl = `${this.callbackBaseUrl}/notifications/sms/callback`;
                const isValid = isValidTwilioSignature(this.twilioAuthToken, signature, fullUrl, params);

                if (!isValid) {
                    console.warn('[SmsNotificationController] Webhook rejected: Invalid Twilio Signature.');
                    response.status(401).json({ message: 'Invalid Twilio signature' });
                    return;
                }
            }

            const messageSid = params.MessageSid;
            const messageStatus = params.MessageStatus;
            const errorCode = params.ErrorCode;
            const errorMessage = params.ErrorMessage;

            if (!messageSid || !messageStatus) {
                response.status(400).json({ message: 'Missing required callback fields (MessageSid, MessageStatus)' });
                return;
            }

            console.log(`[SmsNotificationController] Received status callback for MessageSid ${messageSid}: ${messageStatus}`);

            const prisma = this.smsService['prisma'];
            const sms = await prisma.smsMessage.findUnique({
                where: { providerMessageId: messageSid },
            });

            if (!sms) {
                response.status(200).json({ message: 'Message SID not found' });
                return;
            }

            let statusMap = 'SENT';
            if (messageStatus === 'delivered') {
                statusMap = 'DELIVERED';
            } else if (messageStatus === 'failed' || messageStatus === 'undelivered') {
                statusMap = 'FAILED';
            }

            await prisma.smsMessage.update({
                where: { id: sms.id },
                data: {
                    status: statusMap,
                    errorMessage: errorMessage ? `Code ${errorCode}: ${errorMessage}` : sms.errorMessage,
                },
            });

            response.status(200).json({ success: true });
        } catch (error) {
            console.error('[SmsNotificationController] Status callback handling failed:', error);
            response.status(500).json({ message: 'Internal status callback handling error' });
        }
    }
}
