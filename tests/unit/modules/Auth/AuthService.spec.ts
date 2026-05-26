import { describe, expect, it } from 'vitest';

import { AuthService } from '../../../../src/modules/Auth/application/services/AuthService.js';
import { SessionService } from '../../../../src/modules/Auth/application/services/SessionService.js';
import { TokenService } from '../../../../src/modules/Auth/application/services/TokenService.js';

describe('AuthService', () => {
    it('issues and refreshes auth sessions', () => {
        const tokenService = new TokenService('test-secret', { clock: () => 1_700_000_000 });
        const sessionService = new SessionService({ clock: () => 1_700_000_000 });
        const authService = new AuthService({ tokenService, sessionService });

        const session = authService.issueSession({
            userId: 'user-1',
            roles: ['Tenant Admin'],
            tenantId: 'tenant-1',
            branchId: 'branch-1',
        });

        expect(session.accessContext.userId).toBe('user-1');
        expect(session.refreshToken).toBeTruthy();
        expect(session.claims.sub).toBe('user-1');

        const refreshedSession = authService.refreshSession(session.refreshToken);

        expect(refreshedSession.sessionId).toBe(session.sessionId);
        expect(refreshedSession.refreshToken).not.toBe(session.refreshToken);
    });
});