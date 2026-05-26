import { describe, expect, it } from 'vitest';

import { SessionService } from '../../../../src/modules/Auth/application/services/SessionService.js';

describe('SessionService', () => {
    it('creates, rotates, and revokes refresh sessions', () => {
        const sessionService = new SessionService({ clock: () => 1_700_000_000 });

        const session = sessionService.createSession({
            userId: 'user-1',
            tenantId: 'tenant-1',
            branchId: 'branch-1',
            tokenVersion: 1,
        });

        expect(session.userId).toBe('user-1');
        expect(session.refreshToken).toBeTruthy();
        expect(sessionService.findByRefreshToken(session.refreshToken)).toBeDefined();

        const rotatedSession = sessionService.rotateRefreshToken(session.refreshToken);

        expect(rotatedSession.sessionId).toBe(session.sessionId);
        expect(rotatedSession.refreshToken).not.toBe(session.refreshToken);
        expect(sessionService.findByRefreshToken(session.refreshToken)).toBeUndefined();
        expect(sessionService.findByRefreshToken(rotatedSession.refreshToken)).toBeDefined();

        sessionService.revokeSession(rotatedSession.sessionId);

        expect(sessionService.findByRefreshToken(rotatedSession.refreshToken)).toBeUndefined();
    });
});