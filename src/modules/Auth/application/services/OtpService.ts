import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { type RedisClientType } from 'redis';
import type { AuthDao } from '../dao/AuthDao.js';
import type { IOtpNotificationService } from './IOtpNotificationService.js';

export type OtpGenerateInput = {
    email?: string;
    phoneNumber?: string;
    tenantId?: string;
    branchId?: string;
};

export class OtpService {
    private readonly memoryStore = new Map<string, { verified: boolean; expiresAt: Date }>();

    public constructor(
        private readonly authDao: AuthDao,
        private readonly notificationService: IOtpNotificationService,
        private readonly redisClient: RedisClientType | null = null
    ) {}

    public async generateOtp(input: OtpGenerateInput): Promise<{ token: string; otp: string }> {
        let email = input.email;
        let phoneNumber = input.phoneNumber;

        // If email is provided but no phone number (or phone number is masked), look up the user's real phone number
        if (email && (!phoneNumber || phoneNumber.includes('x') || phoneNumber.includes('X'))) {
            const user = await this.authDao.findByIdentifier(email);
            if (user && user.phoneNumber) {
                phoneNumber = user.phoneNumber;
            }
        }

        if (!email && !phoneNumber) {
            throw new Error('At least one recipient (email or phoneNumber) must be provided.');
        }

        const token = crypto.randomUUID();
        // Generate a cryptographically secure 6-digit numeric OTP code
        const otpVal = crypto.randomInt(100000, 1000000).toString();

        const otpHash = await bcrypt.hash(otpVal, 10);

        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

        await this.authDao.saveOtp({ token, otpHash, expiresAt });

        // Decoupled notification sending
        if (email) {
            await this.notificationService.sendOtp(
                email,
                otpVal,
                'email',
                input.tenantId,
                input.branchId
            );
        }

        if (phoneNumber) {
            await this.notificationService.sendOtp(
                phoneNumber,
                otpVal,
                'sms',
                input.tenantId,
                input.branchId
            );
        }

        return { token, otp: otpVal };
    }

    public async validateOtp(token: string, otp: string): Promise<boolean> {
        const record = await this.authDao.findOtp(token);
        if (!record) {
            return false;
        }

        if (new Date() > new Date(record.expiresAt)) {
            // Delete expired record
            await this.authDao.deleteOtp(token);
            return false;
        }

        const isValid = await bcrypt.compare(otp, record.otpHash);

        // Delete immediately on use/attempt to prevent brute forcing
        await this.authDao.deleteOtp(token);

        return isValid;
    }

    public async validateOtpAndStore(token: string, otp: string): Promise<string | null> {
        const isValid = await this.validateOtp(token, otp);
        if (!isValid) {
            return null;
        }

        const verifiedToken = crypto.randomUUID();
        if (this.redisClient && this.redisClient.isOpen) {
            // Set 5-minute TTL (300 seconds)
            await this.redisClient.setEx(`otp:verified:${verifiedToken}`, 300, 'true');
        } else {
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
            this.memoryStore.set(verifiedToken, { verified: true, expiresAt });
        }
        return verifiedToken;
    }

    public async isOtpTokenValid(token: string): Promise<boolean> {
        if (!token) return false;
        if (this.redisClient && this.redisClient.isOpen) {
            const exists = await this.redisClient.get(`otp:verified:${token}`);
            return exists === 'true';
        } else {
            const entry = this.memoryStore.get(token);
            if (!entry || new Date() > entry.expiresAt) {
                if (entry) this.memoryStore.delete(token);
                return false;
            }
            return entry.verified;
        }
    }

    public async consumeOtpToken(token: string): Promise<boolean> {
        if (!token) return false;
        const valid = await this.isOtpTokenValid(token);
        if (valid) {
            if (this.redisClient && this.redisClient.isOpen) {
                await this.redisClient.del(`otp:verified:${token}`);
            } else {
                this.memoryStore.delete(token);
            }
        }
        return valid;
    }
}
