import { EmailProvider, EmailSendResult } from './EmailProvider.js';

export interface SendGridConfig {
    apiKey: string;
    fromEmail: string;
    fromName?: string;
}

export class SendGridEmailProvider implements EmailProvider {
    public constructor(private readonly config: SendGridConfig) {}

    public async sendEmail(to: string, subject: string, body: string): Promise<EmailSendResult> {
        const { apiKey, fromEmail, fromName } = this.config;
        if (!apiKey || !fromEmail) {
            return {
                success: false,
                error: 'SendGrid is not properly configured. Missing apiKey or fromEmail.',
            };
        }

        const url = 'https://api.sendgrid.com/v3/mail/send';
        
        const payload = {
            personalizations: [
                {
                    to: [{ email: to }]
                }
            ],
            from: {
                email: fromEmail,
                name: fromName || 'DSMS'
            },
            subject: subject,
            content: [
                {
                    type: 'text/html',
                    value: body
                }
            ]
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                // SendGrid v3 mail/send returns 202 Accepted on success
                const xMessageId = response.headers.get('X-Message-Id') || `sg_sid_${Math.random().toString(36).substring(2, 11)}`;
                return {
                    success: true,
                    providerMessageId: xMessageId,
                };
            } else {
                const text = await response.text();
                let errorMessage = `SendGrid error status ${response.status}`;
                try {
                    const errorJson = JSON.parse(text);
                    if (errorJson.errors && errorJson.errors[0]) {
                        errorMessage = errorJson.errors[0].message;
                    }
                } catch {
                    if (text) errorMessage = text;
                }
                return {
                    success: false,
                    error: errorMessage,
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
