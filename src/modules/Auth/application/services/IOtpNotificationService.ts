export interface IOtpNotificationService {
    sendOtp(
        recipient: string,
        otp: string,
        channel: 'email' | 'sms',
        tenantId?: string,
        branchId?: string
    ): Promise<void>;
}
