import { SmsProvider, SmsSendResult } from './SmsProvider.js';

export interface TwilioConfig {
    accountSid: string;
    authToken: string;
    fromNumber: string;
    /**
     * Alphanumeric Sender ID (e.g. "TechSchool", max 11 chars).
     * When set, this is used as the Twilio `From` field instead of `fromNumber`.
     * NOTE: One-way only — recipients cannot reply. Not available in the US.
     */
    alphaId?: string;
}

export class TwilioSmsProvider implements SmsProvider {
    public constructor(private readonly config: TwilioConfig) {}

    public async sendSms(to: string, body: string, callbackUrl?: string, fromOverride?: string): Promise<SmsSendResult> {
        const { accountSid, authToken, fromNumber, alphaId } = this.config;
        // Priority: per-call override → configured alphaId → phone number
        const from = fromOverride?.trim() || alphaId?.trim() || fromNumber;
        if (!accountSid || !authToken || !from) {
            return {
                success: false,
                error: 'Twilio provider is not properly configured. Missing accountSid, authToken, or fromNumber/alphaId.',
            };
        }

        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

        const formData = new URLSearchParams();
        formData.append('To', to);
        formData.append('From', from);
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
                // Check if the error is related to alphanumeric sender ID restrictions (e.g. trial account, country limitations)
                const isAlphaSenderError =
                    data.code === 21624 ||
                    data.code === 21614 ||
                    data.code === 21633 ||
                    data.code === 21634 ||
                    /alphanumeric|trial|sender id/i.test(data.message || '');

                if (from !== fromNumber && isAlphaSenderError) {
                    console.warn(`[TwilioSmsProvider] Alphanumeric Sender ID "${from}" failed: ${data.message || 'unsupported'}. Falling back to default phone number "${fromNumber}"...`);

                    const fallbackFormData = new URLSearchParams();
                    fallbackFormData.append('To', to);
                    fallbackFormData.append('From', fromNumber);
                    fallbackFormData.append('Body', body);
                    if (callbackUrl) {
                        fallbackFormData.append('StatusCallback', callbackUrl);
                    }

                    const fallbackResponse = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Basic ${auth}`,
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: fallbackFormData.toString(),
                    });

                    const fallbackData = await fallbackResponse.json() as any;

                    if (fallbackResponse.ok) {
                        return {
                            success: true,
                            providerMessageId: fallbackData.sid,
                        };
                    } else {
                        return {
                            success: false,
                            error: `Alphanumeric Sender ID failed (${data.message}), and fallback phone number also failed: ${fallbackData.message || `status ${fallbackResponse.status}`}`,
                        };
                    }
                }

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
