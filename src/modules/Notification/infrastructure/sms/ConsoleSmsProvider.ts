import { SmsProvider, SmsSendResult } from './SmsProvider.js';

export class ConsoleSmsProvider implements SmsProvider {
    public async sendSms(to: string, body: string, callbackUrl?: string, fromOverride?: string): Promise<SmsSendResult> {
        const from = fromOverride?.trim() || 'Console';
        const mockMessageId = `mock_sid_${Math.random().toString(36).substring(2, 11)}`;

        console.log(`[ConsoleSmsProvider] Sending SMS from "${from}" to ${to}: "${body}". Callback URL: ${callbackUrl}`);

        if (callbackUrl) {
            try {
                const formData = new URLSearchParams();
                formData.append('MessageSid', mockMessageId);
                formData.append('MessageStatus', 'delivered');

                const response = await fetch(callbackUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData.toString(),
                });

                if (!response.ok) {
                    console.error(`[ConsoleSmsProvider] Mock status callback failed with status ${response.status}`);
                } else {
                    console.log(`[ConsoleSmsProvider] Mock status callback delivered successfully to ${callbackUrl}`);
                }
            } catch (e) {
                console.error('[ConsoleSmsProvider] Failed to invoke mock status callback:', e);
            }
        }

        return {
            success: true,
            providerMessageId: mockMessageId,
        };
    }
}