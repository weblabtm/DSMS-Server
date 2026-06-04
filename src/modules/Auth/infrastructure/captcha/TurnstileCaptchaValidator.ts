import type { ICaptchaValidator } from '../../application/services/ICaptchaValidator.js';

export class TurnstileCaptchaValidator implements ICaptchaValidator {
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
            const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
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
            console.error('[TurnstileCaptchaValidator] Validation error:', error);
            return false;
        }
    }
}
