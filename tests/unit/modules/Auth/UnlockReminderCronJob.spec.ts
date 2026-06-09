import { describe, expect, it, vi } from 'vitest';
import { UnlockReminderCronJob } from '../../../../src/modules/Auth/application/services/UnlockReminderCronJob.js';

describe('UnlockReminderCronJob', () => {
    it('sends email reminders at 1 hour, 30 minutes, and 10 minutes thresholds and updates database state', async () => {
        const now = Date.now();
        // user1 has 55 minutes left (should trigger 1h reminder)
        // user2 has 25 minutes left (should trigger 30m reminder)
        // user3 has 8 minutes left (should trigger 10m reminder)
        // user4 has 1h 10m left (no reminder should trigger yet)
        const lockedUsers = [
            {
                id: 'user-1',
                identifier: 'user1@example.com',
                unlockToken: 'token-1',
                unlockTokenExpiresAt: new Date(now + 55 * 60 * 1000),
                reminder1hSent: false,
                reminder30mSent: false,
                reminder10mSent: false,
                tenantId: 'tenant-1',
                branchId: 'branch-1',
            },
            {
                id: 'user-2',
                identifier: 'user2@example.com',
                unlockToken: 'token-2',
                unlockTokenExpiresAt: new Date(now + 25 * 60 * 1000),
                reminder1hSent: true, // 1h already sent
                reminder30mSent: false,
                reminder10mSent: false,
            },
            {
                id: 'user-3',
                identifier: 'user3@example.com',
                unlockToken: 'token-3',
                unlockTokenExpiresAt: new Date(now + 8 * 60 * 1000),
                reminder1hSent: true,
                reminder30mSent: true,
                reminder10mSent: false,
            },
            {
                id: 'user-4',
                identifier: 'user4@example.com',
                unlockToken: 'token-4',
                unlockTokenExpiresAt: new Date(now + 70 * 60 * 1000),
                reminder1hSent: false,
                reminder30mSent: false,
                reminder10mSent: false,
            },
        ];

        const authDao = {
            findActiveLockedUsers: vi.fn().mockResolvedValue(lockedUsers),
            updateReminderSent: vi.fn().mockResolvedValue(undefined),
        };

        const emailService = {
            queueEmail: vi.fn().mockResolvedValue(undefined),
        };

        const job = new UnlockReminderCronJob(authDao as any, emailService as any);
        await job.execute();

        // 1. Check user-1 (1h reminder)
        expect(emailService.queueEmail).toHaveBeenCalledWith(
            'user1@example.com',
            'Action Required: Account Activation Link Expiring Soon',
            expect.stringContaining('less than 1 hour'),
            'tenant-1',
            'branch-1'
        );
        expect(authDao.updateReminderSent).toHaveBeenCalledWith('user-1', 'reminder1hSent', true);

        // 2. Check user-2 (30m reminder)
        expect(emailService.queueEmail).toHaveBeenCalledWith(
            'user2@example.com',
            'Action Required: Account Activation Link Expiring Soon',
            expect.stringContaining('less than 30 minutes'),
            undefined,
            undefined
        );
        expect(authDao.updateReminderSent).toHaveBeenCalledWith('user-2', 'reminder30mSent', true);

        // 3. Check user-3 (10m reminder)
        expect(emailService.queueEmail).toHaveBeenCalledWith(
            'user3@example.com',
            'Urgent: Account Activation Link Expiring Soon',
            expect.stringContaining('less than 10 minutes'),
            undefined,
            undefined
        );
        expect(authDao.updateReminderSent).toHaveBeenCalledWith('user-3', 'reminder10mSent', true);

        // 4. Check user-4 (no reminder)
        // Ensure emailService queueEmail was only called 3 times total
        expect(emailService.queueEmail).toHaveBeenCalledTimes(3);
    });
});
