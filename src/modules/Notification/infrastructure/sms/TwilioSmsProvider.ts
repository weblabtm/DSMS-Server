import { SmsProvider, SmsSendResult } from './SmsProvider.js';

export interface TwilioConfig {
    accountSid: string;
    authToken: string;
    fromNumber: string;
}

export class TwilioSmsProvider implements SmsProvider {
    public constructor(private readonly config: TwilioConfig) {}

    public async sendSms(to: string, body: string, callbackUrl?: string): Promise<SmsSendResult> {
        const { accountSid, authToken, fromNumber } = this.config;
        if (!accountSid || !authToken || !fromNumber) {
            return {
                success: false,
                error: 'Twilio provider is not properly configured. Missing accountSid, authToken, or fromNumber.',
            };
        }

        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

        const formData = new URLSearchParams();
        formData.append('To', to);
        formData.append('From', fromNumber);
        formData.append('Body', body);
        if (callbackUrl) {
            formData.append('StatusCallback', callbackUrl);
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString(),
            });

            const data = await response.json() as any;

            if (response.ok) {
                return {
                    success: true,
                    providerMessageId: data.sid,
                };
            } else {
                return {
                    success: false,
                    error: data.message || `Twilio error status ${response.status}`,
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
