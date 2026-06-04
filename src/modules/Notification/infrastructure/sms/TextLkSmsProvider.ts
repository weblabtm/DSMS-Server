import { SmsProvider, SmsSendResult } from './SmsProvider.js';

export interface TextLkConfig {
    apiToken: string;
    defaultSenderId: string;
}

export class TextLkSmsProvider implements SmsProvider {
    public constructor(private readonly config: TextLkConfig) {}

    public async sendSms(to: string, body: string, callbackUrl?: string, fromOverride?: string): Promise<SmsSendResult> {
        const { apiToken, defaultSenderId } = this.config;
        const senderId = fromOverride?.trim() || defaultSenderId?.trim();

        if (!apiToken || !senderId) {
            return {
                success: false,
                error: 'Text.lk provider is not properly configured. Missing apiToken or defaultSenderId.',
            };
        }

        // Text.lk expects phone numbers without the leading '+' sign (e.g., '94771234567' instead of '+94771234567')
        const cleanTo = to.startsWith('+') ? to.slice(1) : to;

        const url = 'https://app.text.lk/api/v3/sms/send';

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    recipient: cleanTo,
                    sender_id: senderId,
                    type: 'plain',
                    message: body,
                }),
            });

            const data = await response.json() as any;

            if (response.ok && data.status === 'success') {
                const messageId = typeof data.data === 'object' && data.data?.uid
                    ? data.data.uid
                    : (typeof data.data === 'string' ? data.data : 'textlk-ok');

                return {
                    success: true,
                    providerMessageId: String(messageId),
                };
            } else {
                return {
                    success: false,
                    error: data?.message || data?.data || `Text.lk error status ${response.status}`,
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
