import { describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../../src/modules/Auth/application/services/AuthService.js';
import { SessionService } from '../../../../src/modules/Auth/application/services/SessionService.js';
import { TokenService } from '../../../../src/modules/Auth/application/services/TokenService.js';

describe('AuthService', () => {
    it('issues and refreshes auth sessions', async () => {
        const tokenService = new TokenService('test-secret', { clock: () => 1_700_000_000 });
        const sessionService = new SessionService({ clock: () => 1_700_000_000 });
        const authDao = {
            authenticate: vi.fn(),
            register: vi.fn(),
        };
        const authService = new AuthService({ tokenService, sessionService, authDao: authDao as never });

        const session = await authService.issueSession({
            userId: 'user-1',
            roles: ['Tenant Admin'],
            tenantId: 'tenant-1',
            branchId: 'branch-1',
        });

        expect(session.accessContext.userId).toBe('user-1');
        expect(session.refreshToken).toBeTruthy();
        expect(session.claims.sub).toBe('user-1');

        const refreshedSession = await authService.refreshSession(session.refreshToken);

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
            role: 'Student',
        }, 'Front Desk');

        expect(authDao.register).toHaveBeenCalledWith({
            identifier: 'student@example.com',
            password: 'secret',
            tenantId: 'tenant-1',
            branchId: 'branch-1',
            role: 'Student',
        });
        expect(session.userId).toBe('user-2');
        expect(session.roles).toEqual(['Student']);
        expect(session.accessToken).toBeTruthy();
    });

    it('rejects registration without an inviter role', async () => {
        const tokenService = new TokenService('test-secret', { clock: () => 1_700_000_000 });
        const sessionService = new SessionService({ clock: () => 1_700_000_000 });
        const authDao = {
            authenticate: vi.fn(),
            register: vi.fn(),
        };
        const authService = new AuthService({ tokenService, sessionService, authDao: authDao as never });

        await expect(authService.register({
            identifier: 'student@example.com',
            password: 'secret',
            role: 'Student',
        } as never, 'Student')).rejects.toThrow('Role Student cannot create Student');
    });

    it('logs out by revoking the matching session', async () => {
        const tokenService = new TokenService('test-secret', { clock: () => 1_700_000_000 });
        const sessionService = new SessionService({ clock: () => 1_700_000_000 });
        const authDao = {
            authenticate: vi.fn(),
            register: vi.fn(),
        };
        const authService = new AuthService({ tokenService, sessionService, authDao: authDao as never });

        const session = await authService.issueSession({
            userId: 'user-1',
            roles: ['Tenant Admin'],
        });

        await authService.logout({ refreshToken: session.refreshToken });

        expect(await sessionService.findByRefreshToken(session.refreshToken)).toBeUndefined();
    });
});