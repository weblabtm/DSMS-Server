export interface IBruteForceStore {
    logAttempt(key: string, timestamp: number, ttlSeconds: number): Promise<number>;
    getAttemptCount(key: string, minTimestamp: number): Promise<number>;
    resetAttempts(key: string): Promise<void>;
}

export type BruteForceProtectionServiceOptions = {
    maxFailedAttemptsPerIp?: number;
    maxFailedAttemptsPerAccount?: number;
    ipBlockDurationSeconds?: number;
    accountLockoutWindowSeconds?: number;
    max404AttemptsPerIp?: number;
    ip404BlockDurationSeconds?: number;
};

export class BruteForceProtectionService {
    private readonly maxFailedAttemptsPerIp: number;
    private readonly maxFailedAttemptsPerAccount: number;
    private readonly ipBlockDurationSeconds: number;
    private readonly accountLockoutWindowSeconds: number;
    private readonly max404AttemptsPerIp: number;
    private readonly ip404BlockDurationSeconds: number;

    public constructor(
        private readonly store: IBruteForceStore,
        options?: BruteForceProtectionServiceOptions
    ) {
        this.maxFailedAttemptsPerIp = options?.maxFailedAttemptsPerIp ?? 10;
        this.maxFailedAttemptsPerAccount = options?.maxFailedAttemptsPerAccount ?? 5;
        this.ipBlockDurationSeconds = options?.ipBlockDurationSeconds ?? 900; // 15 mins
        this.accountLockoutWindowSeconds = options?.accountLockoutWindowSeconds ?? 86400; // 24 hours
        this.max404AttemptsPerIp = options?.max404AttemptsPerIp ?? 10;
        this.ip404BlockDurationSeconds = options?.ip404BlockDurationSeconds ?? 86400; // 24 hours
    }

    public async isIpBlocked(ip: string): Promise<boolean> {
        const now = Date.now();
        // Check if explicit IP block exists
        const blockCount = await this.store.getAttemptCount(`brute:ip:blocked:${ip}`, now - 31536000000); // query all active
        if (blockCount > 0) {
            return true;
        }

        // Also check if current sliding window logs exceed limit
        const windowStart = now - this.ipBlockDurationSeconds * 1000;
        const failCount = await this.store.getAttemptCount(`brute:ip:fail:${ip}`, windowStart);
        return failCount >= this.maxFailedAttemptsPerIp;
    }

    public async registerFailure(ip: string, identifier: string): Promise<{ ipBlocked: boolean; accountLocked: boolean }> {
        const now = Date.now();

        // 1. Log and check IP failure
        const ipKey = `brute:ip:fail:${ip}`;
        await this.store.logAttempt(ipKey, now, this.ipBlockDurationSeconds);
        const ipFailures = await this.store.getAttemptCount(ipKey, now - this.ipBlockDurationSeconds * 1000);
        const ipBlocked = ipFailures >= this.maxFailedAttemptsPerIp;
        if (ipBlocked) {
            await this.store.logAttempt(`brute:ip:blocked:${ip}`, now, this.ipBlockDurationSeconds);
        }

        // 2. Log and check Account failure
        const accountKey = `brute:account:fail:${identifier}`;
        await this.store.logAttempt(accountKey, now, this.accountLockoutWindowSeconds);
        const accountFailures = await this.store.getAttemptCount(accountKey, now - this.accountLockoutWindowSeconds * 1000);
        const accountLocked = accountFailures >= this.maxFailedAttemptsPerAccount;

        return { ipBlocked, accountLocked };
    }

    public async register404(ip: string): Promise<boolean> {
        const now = Date.now();
        const key = `brute:ip:404:${ip}`;
        // 404 tracking window is 1 minute (60 seconds)
        await this.store.logAttempt(key, now, 60);
        const count = await this.store.getAttemptCount(key, now - 60000);

        const shouldBlock = count >= this.max404AttemptsPerIp;
        if (shouldBlock) {
            await this.store.logAttempt(`brute:ip:blocked:${ip}`, now, this.ip404BlockDurationSeconds);
        }
        return shouldBlock;
    }

    public async registerSuccess(ip: string, identifier: string): Promise<void> {
        await this.store.resetAttempts(`brute:ip:fail:${ip}`);
        await this.store.resetAttempts(`brute:account:fail:${identifier}`);
    }
}
