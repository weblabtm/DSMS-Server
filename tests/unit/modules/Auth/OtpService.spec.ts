import { describe, expect, it, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { InMemoryAuthDao } from '../../../../src/modules/Auth/infrastructure/InMemoryAuthDao.js';
import { OtpService } from '../../../../src/modules/Auth/application/services/OtpService.js';
import type { IOtpNotificationService } from '../../../../src/modules/Auth/application/services/IOtpNotificationService.js';

describe('OtpService', () => {
    let authDao: InMemoryAuthDao;
    let mockNotificationService: IOtpNotificationService;
    let otpService: OtpService;

    beforeEach(() => {
        authDao = new InMemoryAuthDao();
        mockNotificationService = {
            sendOtp: vi.fn().mockResolvedValue(undefined),
        };
        otpService = new OtpService(authDao, mockNotificationService);
    });

    it('generates a 6-digit OTP, hashes it, and saves it in the database', async () => {
        const result = await otpService.generateOtp({
            email: 'test@example.com',
            phoneNumber: '+94771234567',
            tenantId: 'tenant-123',
            branchId: 'branch-456',
        });

        expect(result.token).toBeTruthy();
        expect(result.otp).toHaveLength(6);
        expect(/^\d{6}$/.test(result.otp)).toBe(true);

        // Check it was saved in the db
        const saved = await authDao.findOtp(result.token);
        expect(saved).toBeTruthy();
        expect(saved!.token).toBe(result.token);
        expect(saved!.expiresAt.getTime()).toBeGreaterThan(Date.now());
        
        // Verify hashed OTP
        const match = await bcrypt.compare(result.otp, saved!.otpHash);
        expect(match).toBe(true);
    });

    it('dispatches notifications to both email and SMS channels when provided', async () => {
        const result = await otpService.generateOtp({
            email: 'test@example.com',
            phoneNumber: '+94771234567',
            tenantId: 'tenant-123',
            branchId: 'branch-456',
        });

        expect(mockNotificationService.sendOtp).toHaveBeenCalledTimes(2);
        expect(mockNotificationService.sendOtp).toHaveBeenCalledWith(
            'test@example.com',
            result.otp,
            'email',
            'tenant-123',
            'branch-456'
        );
        expect(mockNotificationService.sendOtp).toHaveBeenCalledWith(
            '+94771234567',
            result.otp,
            'sms',
            'tenant-123',
            'branch-456'
        );
    });

    it('dispatches only email when phoneNumber is missing', async () => {
        await otpService.generateOtp({
            email: 'test@example.com',
        });

        expect(mockNotificationService.sendOtp).toHaveBeenCalledTimes(1);
        expect(mockNotificationService.sendOtp).toHaveBeenCalledWith(
            'test@example.com',
            expect.any(String),
            'email',
            undefined,
            undefined
        );
    });

    it('dispatches only SMS when email is missing', async () => {
        await otpService.generateOtp({
            phoneNumber: '+94771234567',
        });

        expect(mockNotificationService.sendOtp).toHaveBeenCalledTimes(1);
        expect(mockNotificationService.sendOtp).toHaveBeenCalledWith(
            '+94771234567',
            expect.any(String),
            'sms',
            undefined,
            undefined
        );
    });

    it('throws error if neither email nor phoneNumber is provided during generation', async () => {
        await expect(otpService.generateOtp({})).rejects.toThrow(
            'At least one recipient (email or phoneNumber) must be provided.'
        );
    });

    it('validates a correct OTP and deletes it from database', async () => {
        const generated = await otpService.generateOtp({ email: 'test@example.com' });
        
        const isValid = await otpService.validateOtp(generated.token, generated.otp);
        expect(isValid).toBe(true);

        // Record should be deleted immediately from DB
        const saved = await authDao.findOtp(generated.token);
        expect(saved).toBeNull();
    });

    it('returns false and deletes OTP from database if OTP is wrong (prevents brute-force)', async () => {
        const generated = await otpService.generateOtp({ email: 'test@example.com' });
        
        const isValid = await otpService.validateOtp(generated.token, 'wrong_otp');
        expect(isValid).toBe(false);

        // Record should be deleted immediately even on failure
        const saved = await authDao.findOtp(generated.token);
        expect(saved).toBeNull();
    });

    it('returns false if OTP token does not exist', async () => {
        const isValid = await otpService.validateOtp('non-existent-token', '123456');
        expect(isValid).toBe(false);
    });

    it('returns false and deletes OTP if token has expired', async () => {
        const token = 'expired-token';
        const otpHash = await bcrypt.hash('123456', 10);
        // Expiry set in the past
        const expiresAt = new Date(Date.now() - 1000);

        await authDao.saveOtp({ token, otpHash, expiresAt });

        const isValid = await otpService.validateOtp(token, '123456');
        expect(isValid).toBe(false);

        // Record deleted on validation check
        const saved = await authDao.findOtp(token);
        expect(saved).toBeNull();
    });
});
