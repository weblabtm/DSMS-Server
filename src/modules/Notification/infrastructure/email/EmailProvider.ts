export interface EmailSendResult {
    success: boolean;
    providerMessageId?: string;
    error?: string;
}

export interface EmailProvider {
    sendEmail(to: string, subject: string, body: string): Promise<EmailSendResult>;
}
