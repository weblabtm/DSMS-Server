export interface SmsSendResult {
    success: boolean;
    providerMessageId?: string;
    error?: string;
}

export interface SmsProvider {
    /**
     * @param fromOverride  When provided, used as the Twilio `From` sender instead of the
     *                      provider's configured default (phone number or alphaId).
     *                      Useful for per-tenant alphanumeric sender IDs.
     */
    sendSms(to: string, body: string, callbackUrl?: string, fromOverride?: string): Promise<SmsSendResult>;
}
