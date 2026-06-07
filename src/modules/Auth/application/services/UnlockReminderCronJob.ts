import { CronJob } from '../../../../shared/infrastructure/cron/CronJob.js';
import type { AuthDao } from '../dao/AuthDao.js';

export interface IEmailService {
    queueEmail(to: string, subject: string, body: string, tenantId?: string, branchId?: string): Promise<any>;
}

export class UnlockReminderCronJob extends CronJob {
    public override readonly name = 'UnlockReminder';
    // Run every 1 minute
    public override readonly intervalMs = 60 * 1000;

    public constructor(
        private readonly authDao: AuthDao,
        private readonly emailService?: IEmailService
    ) {
        super();
    }

    public override async execute(): Promise<void> {
        if (!this.emailService) {
            return;
        }

        try {
            const lockedUsers = await this.authDao.findActiveLockedUsers();
            const now = Date.now();

            for (const user of lockedUsers) {
                const diffMs = user.unlockTokenExpiresAt.getTime() - now;
                const minutesRemaining = diffMs / 60000;

                // Check 10-minute threshold first to ensure we don't skip it if multiple thresholds are met
                if (minutesRemaining <= 10 && !user.reminder10mSent) {
                    await this.emailService.queueEmail(
                        user.identifier,
                        'Urgent: Account Activation Link Expiring Soon',
                        `Urgent: Your account unlock link will expire in less than 10 minutes. Please activate your account immediately. If the link expires, you will need to contact the Driving School to reactivate your account.`,
                        user.tenantId,
                        user.branchId
                    );
                    await this.authDao.updateReminderSent(user.id, 'reminder10mSent', true);
                    console.log(`[UnlockReminderCronJob] Sent 10-minute unlock reminder to ${user.identifier}`);
                }
                // Check 30-minute threshold next
                else if (minutesRemaining <= 30 && !user.reminder30mSent) {
                    await this.emailService.queueEmail(
                        user.identifier,
                        'Action Required: Account Activation Link Expiring Soon',
                        `Your account unlock link will expire in less than 30 minutes. Please activate your account. If the link expires, you will need to contact the Driving School to reactivate your account.`,
                        user.tenantId,
                        user.branchId
                    );
                    await this.authDao.updateReminderSent(user.id, 'reminder30mSent', true);
                    console.log(`[UnlockReminderCronJob] Sent 30-minute unlock reminder to ${user.identifier}`);
                }
                // Check 1-hour threshold last
                else if (minutesRemaining <= 60 && !user.reminder1hSent) {
                    await this.emailService.queueEmail(
                        user.identifier,
                        'Action Required: Account Activation Link Expiring Soon',
                        `Your account unlock link will expire in less than 1 hour. Please activate your account. If the link expires, you will need to contact the Driving School to reactivate your account.`,
                        user.tenantId,
                        user.branchId
                    );
                    await this.authDao.updateReminderSent(user.id, 'reminder1hSent', true);
                    console.log(`[UnlockReminderCronJob] Sent 1-hour unlock reminder to ${user.identifier}`);
                }
            }
        } catch (error) {
            console.error('[UnlockReminderCronJob] Failed to process unlock reminders:', error);
        }
    }
}
