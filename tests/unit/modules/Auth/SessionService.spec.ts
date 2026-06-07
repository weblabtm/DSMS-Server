import { describe, expect, it } from 'vitest';

import { SessionService } from '../../../../src/modules/Auth/application/services/SessionService.js';

describe('SessionService', () => {
    it('creates, rotates, and revokes refresh sessions', async () => {
        const sessionService = new SessionService({ clock: () => 1_700_000_000 });

        const session = await sessionService.createSession({
            userId: 'user-1',
            tenantId: 'tenant-1',
            branchId: 'branch-1',
            tokenVersion: 1,
        });

        expect(session.userId).toBe('user-1');
        expect(session.refreshToken).toBeTruthy();
        expect(await sessionService.findByRefreshToken(session.refreshToken)).toBeDefined();

        const rotatedSession = await sessionService.rotateRefreshToken(session.refreshToken);

        expect(rotatedSession.sessionId).toBe(session.sessionId);
        expect(rotatedSession.refreshToken).not.toBe(session.refreshToken);
        expect(await sessionService.findByRefreshToken(session.refreshToken)).toBeUndefined();
        expect(await sessionService.findByRefreshToken(rotatedSession.refreshToken)).toBeDefined();

        await sessionService.revokeSession(rotatedSession.sessionId);

        expect(await sessionService.findByRefreshToken(rotatedSession.refreshToken)).toBeUndefined();
    });

    it('respects rememberMe and sets correct TTL on creation and rotation', async () => {
        const clockVal = 1_700_000_000;
        const sessionService = new SessionService({ clock: () => clockVal });

        // 1. rememberMe = true (30 days = 2,592,000 seconds)
        const sessionLong = await sessionService.createSessionWithAccessJti({
            userId: 'user-1',
            accessTokenJti: 'jti-1',
            rememberMe: true,
        });
        expect(sessionLong.rememberMe).toBe(true);
        expect(sessionLong.expiresAt).toBe(clockVal + 30 * 24 * 60 * 60);

        // Rotate and ensure 30-day TTL is kept
        const rotatedLong = await sessionService.rotateRefreshToken(sessionLong.refreshToken);
        expect(rotatedLong.expiresAt).toBe(clockVal + 30 * 24 * 60 * 60);

        // 2. rememberMe = false (7 days = 604,800 seconds)
        const sessionShort = await sessionService.createSessionWithAccessJti({
            userId: 'user-2',
            accessTokenJti: 'jti-2',
            rememberMe: false,
        });
        expect(sessionShort.rememberMe).toBe(false);
        expect(sessionShort.expiresAt).toBe(clockVal + 7 * 24 * 60 * 60);

        // Rotate and ensure 7-day TTL is kept
        const rotatedShort = await sessionService.rotateRefreshToken(sessionShort.refreshToken);
        expect(rotatedShort.expiresAt).toBe(clockVal + 7 * 24 * 60 * 60);
    });
});