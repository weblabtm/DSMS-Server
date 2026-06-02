export interface SmsSendResult {
    success: boolean;
    providerMessageId?: string;
    error?: string;
}

export interface SmsProvider {
    sendSms(to: string, body: string, callbackUrl?: string): Promise<SmsSendResult>;
}
