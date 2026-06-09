import { describe, expect, it } from 'vitest';
import { BruteForceProtectionService } from '../../../../src/modules/Auth/application/services/BruteForceProtectionService.js';
import type { IBruteForceStore } from '../../../../src/modules/Auth/application/services/BruteForceProtectionService.js';

class InMemoryBruteForceStore implements IBruteForceStore {
    private store: Map<string, { timestamp: number }[]> = new Map();

    public async logAttempt(key: string, timestamp: number, ttlSeconds: number): Promise<number> {
        if (!this.store.has(key)) {
            this.store.set(key, []);
        }
        this.store.get(key)!.push({ timestamp });
        return this.store.get(key)!.length;
    }

    public async getAttemptCount(key: string, minTimestamp: number): Promise<number> {
        const attempts = this.store.get(key) || [];
        const validAttempts = attempts.filter(a => a.timestamp >= minTimestamp);
        this.store.set(key, validAttempts);
        return validAttempts.length;
    }

    public async resetAttempts(key: string): Promise<void> {
        this.store.delete(key);
    }
}

describe('BruteForceProtectionService', () => {
    it('blocks IP after configured failed attempts limit within sliding window', async () => {
        const store = new InMemoryBruteForceStore();
        const service = new BruteForceProtectionService(store, {
            maxFailedAttemptsPerIp: 3,
            maxFailedAttemptsPerAccount: 5,
            ipBlockDurationSeconds: 10,
        });

        const ip = '192.168.1.1';
        const account = 'test@example.com';

        // Initial state
        expect(await service.isIpBlocked(ip)).toBe(false);

        // 1st failure
        let res = await service.registerFailure(ip, account);
        expect(res.ipBlocked).toBe(false);
        expect(await service.isIpBlocked(ip)).toBe(false);

        // 2nd failure
        res = await service.registerFailure(ip, account);
        expect(res.ipBlocked).toBe(false);

        // 3rd failure (triggers block)
        res = await service.registerFailure(ip, account);
        expect(res.ipBlocked).toBe(true);
        expect(await service.isIpBlocked(ip)).toBe(true);
    });

    it('locks account after configured failed attempts limit', async () => {
        const store = new InMemoryBruteForceStore();
        const service = new BruteForceProtectionService(store, {
            maxFailedAttemptsPerIp: 10,
            maxFailedAttemptsPerAccount: 3,
        });

        const ip = '192.168.1.1';
        const account = 'test@example.com';

        // 1st failure
        let res = await service.registerFailure(ip, account);
        expect(res.accountLocked).toBe(false);

        // 2nd failure
        res = await service.registerFailure(ip, account);
        expect(res.accountLocked).toBe(false);

        // 3rd failure (triggers account lockout)
        res = await service.registerFailure(ip, account);
        expect(res.accountLocked).toBe(true);
    });

    it('resets attempt logs on successful registration', async () => {
        const store = new InMemoryBruteForceStore();
        const service = new BruteForceProtectionService(store, {
            maxFailedAttemptsPerIp: 3,
            maxFailedAttemptsPerAccount: 3,
        });

        const ip = '192.168.1.1';
        const account = 'test@example.com';

        await service.registerFailure(ip, account);
        await service.registerFailure(ip, account);

        // Reset
        await service.registerSuccess(ip, account);

        // Failures should start from 0
        const res = await service.registerFailure(ip, account);
        expect(res.ipBlocked).toBe(false);
        expect(res.accountLocked).toBe(false);
    });

    it('detects and blocks 404 path-scanning IP', async () => {
        const store = new InMemoryBruteForceStore();
        const service = new BruteForceProtectionService(store, {
            max404AttemptsPerIp: 3,
            ip404BlockDurationSeconds: 10,
        });

        const ip = '192.168.1.5';

        expect(await service.isIpBlocked(ip)).toBe(false);

        // 1st 404
        let blocked = await service.register404(ip);
        expect(blocked).toBe(false);

        // 2nd 404
        blocked = await service.register404(ip);
        expect(blocked).toBe(false);

        // 3rd 404 (triggers block)
        blocked = await service.register404(ip);
        expect(blocked).toBe(true);
        expect(await service.isIpBlocked(ip)).toBe(true);
    });
});
