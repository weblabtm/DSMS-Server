import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CaptchaService } from '../../../../src/modules/Auth/application/services/CaptchaService.js';
import { type ICaptchaValidator } from '../../../../src/modules/Auth/application/services/ICaptchaValidator.js';

describe('CaptchaService', () => {
    let mockValidator: ICaptchaValidator;
    let captchaService: CaptchaService;

    beforeEach(() => {
        mockValidator = {
            validate: vi.fn().mockResolvedValue(true),
        };
        // Use in-memory store by passing null for Redis
        captchaService = new CaptchaService(mockValidator, null);
    });

    it('validates captcha token and stores a transient verified token', async () => {
        const token = await captchaService.validateAndStore('good-token', '127.0.0.1');

        expect(token).toBeTruthy();
        expect(mockValidator.validate).toHaveBeenCalledWith('good-token', '127.0.0.1');
        
        const isValid = await captchaService.isTokenValid(token!);
        expect(isValid).toBe(true);
    });

    it('returns null and does not store token if validation fails', async () => {
        mockValidator.validate = vi.fn().mockResolvedValue(false);

        const token = await captchaService.validateAndStore('bad-token', '127.0.0.1');

        expect(token).toBeNull();
        expect(mockValidator.validate).toHaveBeenCalledWith('bad-token', '127.0.0.1');
    });

    it('consumes a verified token making it invalid on next check (single-use)', async () => {
        const token = await captchaService.validateAndStore('good-token', '127.0.0.1');
        expect(token).toBeTruthy();

        const consumed = await captchaService.consumeToken(token!);
        expect(consumed).toBe(true);

        const isStillValid = await captchaService.isTokenValid(token!);
        expect(isStillValid).toBe(false);
    });

    it('returns false when consuming an invalid or non-existent token', async () => {
        const consumed = await captchaService.consumeToken('non-existent');
        expect(consumed).toBe(false);
    });
});
