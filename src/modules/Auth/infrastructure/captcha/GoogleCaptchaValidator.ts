import type { ICaptchaValidator } from '../../application/services/ICaptchaValidator.js';

export class GoogleCaptchaValidator implements ICaptchaValidator {
    public constructor(
        private readonly secretKey: string,
        private readonly disableCaptcha: boolean = false
    ) {}

    public async validate(token: string, ip?: string): Promise<boolean> {
        if (this.disableCaptcha) {
            return true;
        }

        if (!token) {
            return false;
        }

        try {
            const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    secret: this.secretKey,
                    response: token,
                    ...(ip ? { remoteip: ip } : {}),
                }),
            });

            if (!response.ok) {
                return false;
            }

            const data = (await response.json()) as { success: boolean };
            return !!data.success;
        } catch (error) {
            console.error('[GoogleCaptchaValidator] Validation error:', error);
            return false;
        }
    }
}
