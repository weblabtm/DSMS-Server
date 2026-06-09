import nodemailer from 'nodemailer';
import { EmailProvider, EmailSendResult } from './EmailProvider.js';

export interface NodemailerConfig {
    host: string;
    port: number;
    secure: boolean;
    auth?: {
        user: string;
        pass: string;
    };
    fromEmail: string;
    fromName?: string;
}

export class NodemailerEmailProvider implements EmailProvider {
    private transporter: nodemailer.Transporter;

    public constructor(private readonly config: NodemailerConfig) {
        const transportOptions: any = {
            host: config.host,
            port: config.port,
            secure: config.secure,
        };

        if (config.auth?.user && config.auth?.pass) {
            transportOptions.auth = {
                user: config.auth.user,
                pass: config.auth.pass,
            };
        }

        this.transporter = nodemailer.createTransport(transportOptions);
    }

    public async sendEmail(to: string, subject: string, body: string): Promise<EmailSendResult> {
        const { host, fromEmail, fromName } = this.config;
        if (!host) {
            return {
                success: false,
                error: 'Nodemailer is not properly configured. Missing host.',
            };
        }
        if (!fromEmail) {
            return {
                success: false,
                error: 'Nodemailer is not properly configured. Missing fromEmail.',
            };
        }

        try {
            const info = await this.transporter.sendMail({
                from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
                to: to,
                subject: subject,
                html: body,
            });

            return {
                success: true,
                providerMessageId: info.messageId || `nodemailer_sid_${Math.random().toString(36).substring(2, 11)}`,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
