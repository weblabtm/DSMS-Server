import { CronJob } from '../../../../shared/infrastructure/cron/CronJob.js';
import type { AuthDao } from '../dao/AuthDao.js';

export class OtpCleanupCronJob extends CronJob {
    public override readonly name = 'OtpCleanup';
    // Run every 1 minute
    public override readonly intervalMs = 60 * 1000;

    public constructor(private readonly authDao: AuthDao) {
        super();
    }

    public override async execute(): Promise<void> {
        try {
            const count = await this.authDao.deleteExpiredOtps();
            if (count > 0) {
                console.log(`[OtpCleanupCronJob] Automatically deleted ${count} expired OTP(s) from database.`);
            }
        } catch (error) {
            console.error('[OtpCleanupCronJob] Failed to clean up expired OTPs:', error);
        }
    }
}
