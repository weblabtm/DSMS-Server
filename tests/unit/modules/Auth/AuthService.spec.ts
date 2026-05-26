import { describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../../src/modules/Auth/application/services/AuthService.js';
import { SessionService } from '../../../../src/modules/Auth/application/services/SessionService.js';
import { TokenService } from '../../../../src/modules/Auth/application/services/TokenService.js';

describe('AuthService', () => {
    it('issues and refreshes auth sessions', () => {
        const tokenService = new TokenService('test-secret', { clock: () => 1_700_000_000 });
        const sessionService = new SessionService({ clock: () => 1_700_000_000 });
        const authDao = {
            authenticate: vi.fn(),
            register: vi.fn(),
        };
        const authService = new AuthService({ tokenService, sessionService, authDao: authDao as never });

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

    it('registers a new account and logs it in immediately', async () => {
        const tokenService = new TokenService('test-secret', { clock: () => 1_700_000_000 });
        const sessionService = new SessionService({ clock: () => 1_700_000_000 });
        const authDao = {
            authenticate: vi.fn(),
            register: vi.fn().mockResolvedValue({
                userId: 'user-2',
                roles: ['Student'],
                tenantId: 'tenant-1',
                branchId: 'branch-1',
            }),
        };
        const authService = new AuthService({ tokenService, sessionService, authDao: authDao as never });

        const session = await authService.register({
            identifier: 'student@example.com',
            password: 'secret',
            tenantId: 'tenant-1',
            branchId: 'branch-1',
        });

        expect(authDao.register).toHaveBeenCalledWith({
            identifier: 'student@example.com',
            password: 'secret',
            tenantId: 'tenant-1',
            branchId: 'branch-1',
        });
        expect(session.userId).toBe('user-2');
        expect(session.roles).toEqual(['Student']);
        expect(session.accessToken).toBeTruthy();
    });

    it('logs out by revoking the matching session', () => {
        const tokenService = new TokenService('test-secret', { clock: () => 1_700_000_000 });
        const sessionService = new SessionService({ clock: () => 1_700_000_000 });
        const authDao = {
            authenticate: vi.fn(),
            register: vi.fn(),
        };
        const authService = new AuthService({ tokenService, sessionService, authDao: authDao as never });

        const session = authService.issueSession({
            userId: 'user-1',
            roles: ['Tenant Admin'],
        });

        authService.logout({ refreshToken: session.refreshToken });

        expect(sessionService.findByRefreshToken(session.refreshToken)).toBeUndefined();
    });
});