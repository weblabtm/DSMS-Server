export interface ICaptchaValidator {
    validate(token: string, ip?: string): Promise<boolean>;
}
