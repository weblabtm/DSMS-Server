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
        expect(consumed).toBeTruthy();

        const isStillValid = await captchaService.isTokenValid(token!);
        expect(isStillValid).toBe(false);
    });

    it('returns false when consuming an invalid or non-existent token', async () => {
        const consumed = await captchaService.consumeToken('non-existent');
        expect(consumed).toBeNull();
    });

    // ── Device + identifier binding ───────────────────────────────────────────

    it('validates token when identifier and device fingerprint match', async () => {
        const token = await captchaService.validateAndStore(
            'good-token', '127.0.0.1', 'user@example.com', '', 'device-abc'
        );
        expect(token).toBeTruthy();

        const isValid = await captchaService.isTokenValid(token!, 'user@example.com', 'device-abc');
        expect(isValid).toBe(true);
    });

    it('rejects token when identifier does not match', async () => {
        const token = await captchaService.validateAndStore(
            'good-token', '127.0.0.1', 'user@example.com', '', 'device-abc'
        );
        expect(token).toBeTruthy();

        const isValid = await captchaService.isTokenValid(token!, 'other@example.com', 'device-abc');
        expect(isValid).toBe(false);
    });

    it('rejects token when device fingerprint does not match', async () => {
        const token = await captchaService.validateAndStore(
            'good-token', '127.0.0.1', 'user@example.com', '', 'device-abc'
        );
        expect(token).toBeTruthy();

        const isValid = await captchaService.isTokenValid(token!, 'user@example.com', 'device-xyz');
        expect(isValid).toBe(false);
    });

    it('consumeToken respects binding and rejects mismatched identifier', async () => {
        const token = await captchaService.validateAndStore(
            'good-token', '127.0.0.1', 'user@example.com', '', 'device-abc'
        );
        expect(token).toBeTruthy();

        // Wrong identifier — should fail
        const consumed = await captchaService.consumeToken(token!, 'attacker@example.com', 'device-abc');
        expect(consumed).toBeNull();

        // Token should still be valid for the correct user
        const stillValid = await captchaService.isTokenValid(token!, 'user@example.com', 'device-abc');
        expect(stillValid).toBe(true);
    });

    it('consumeToken respects binding and rejects mismatched device fingerprint', async () => {
        const token = await captchaService.validateAndStore(
            'good-token', '127.0.0.1', 'user@example.com', '', 'device-abc'
        );
        expect(token).toBeTruthy();

        // Wrong device — should fail
        const consumed = await captchaService.consumeToken(token!, 'user@example.com', 'device-other');
        expect(consumed).toBeNull();

        // Token should still be valid for the correct device
        const stillValid = await captchaService.isTokenValid(token!, 'user@example.com', 'device-abc');
        expect(stillValid).toBe(true);
    });

    it('consumeToken succeeds when identifier and device fingerprint match', async () => {
        const token = await captchaService.validateAndStore(
            'good-token', '127.0.0.1', 'user@example.com', '', 'device-abc'
        );
        expect(token).toBeTruthy();

        const consumed = await captchaService.consumeToken(token!, 'user@example.com', 'device-abc');
        expect(consumed).toBeTruthy();

        // Token is now consumed
        const isStillValid = await captchaService.isTokenValid(token!);
        expect(isStillValid).toBe(false);
    });
});
