import { EmailProvider, EmailSendResult } from './EmailProvider.js';

export class ConsoleEmailProvider implements EmailProvider {
    public async sendEmail(to: string, subject: string, body: string): Promise<EmailSendResult> {
        console.log('==================================================');
        console.log(`[ConsoleEmailProvider] Sending Email:`);
        console.log(`- To:      ${to}`);
        console.log(`- Subject: ${subject}`);
        console.log(`- Body:    \n${body}`);
        console.log('==================================================');

        return {
            success: true,
            providerMessageId: `mock_sg_sid_${Math.random().toString(36).substring(2, 11)}`,
        };
    }
}
