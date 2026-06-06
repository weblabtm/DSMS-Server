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

    it('blocks login if CAPTCHA validation fails', async () => {
        const tokenService = new TokenService('test-secret');
        const sessionService = new SessionService();
        const authDao = {
            authenticate: vi.fn(),
            register: vi.fn(),
            isAccountLocked: vi.fn().mockResolvedValue(false),
        };
        const captchaValidator = {
            validate: vi.fn().mockResolvedValue(false),
        };
        const authService = new AuthService({
            tokenService,
            sessionService,
            authDao: authDao as never,
            captchaValidator,
        });

        await expect(authService.login({
            identifier: 'test@example.com',
            password: 'secret',
            captchaToken: 'bad-token',
        })).rejects.toThrow('Invalid CAPTCHA token');
    });

    it('blocks login if IP is rate-limited/blocked', async () => {
        const tokenService = new TokenService('test-secret');
        const sessionService = new SessionService();
        const authDao = {
            authenticate: vi.fn(),
            register: vi.fn(),
            isAccountLocked: vi.fn().mockResolvedValue(false),
        };
        const bruteForceService = {
            isIpBlocked: vi.fn().mockResolvedValue(true),
        };
        const authService = new AuthService({
            tokenService,
            sessionService,
            authDao: authDao as never,
            bruteForceService: bruteForceService as never,
        });

        await expect(authService.login({
            identifier: 'test@example.com',
            password: 'secret',
            ipAddress: '1.2.3.4',
        })).rejects.toThrow('Too many login attempts. Please try again later.');
    });

    it('locks account and sends email when failure threshold is reached', async () => {
        const tokenService = new TokenService('test-secret');
        const sessionService = new SessionService();
        const authDao = {
            authenticate: vi.fn().mockResolvedValue(null),
            isAccountLocked: vi.fn().mockResolvedValue(false),
            lockAccount: vi.fn().mockResolvedValue(undefined),
        };
        const bruteForceService = {
            isIpBlocked: vi.fn().mockResolvedValue(false),
            registerFailure: vi.fn().mockResolvedValue({ ipBlocked: false, accountLocked: true }),
        };
        const emailService = {
            queueEmail: vi.fn().mockResolvedValue(undefined),
        };
        const authService = new AuthService({
            tokenService,
            sessionService,
            authDao: authDao as never,
            bruteForceService: bruteForceService as never,
            emailService: emailService as never,
        });

        await expect(authService.login({
            identifier: 'target@example.com',
            password: 'wrong-password',
            ipAddress: '1.2.3.4',
        })).rejects.toThrow('Invalid credentials');

        expect(bruteForceService.registerFailure).toHaveBeenCalledWith('1.2.3.4', 'target@example.com');
        expect(authDao.lockAccount).toHaveBeenCalledWith('target@example.com', expect.any(String), expect.any(Date));
        expect(emailService.queueEmail).toHaveBeenCalledWith(
            'target@example.com',
            'Account Locked',
            expect.stringContaining('/auth/unlock?token='),
            undefined,
            undefined
        );
    });

    it('blocks login if account is locked in database', async () => {
        const tokenService = new TokenService('test-secret');
        const sessionService = new SessionService();
        const authDao = {
            authenticate: vi.fn(),
            isAccountLocked: vi.fn().mockResolvedValue(true),
        };
        const authService = new AuthService({
            tokenService,
            sessionService,
            authDao: authDao as never,
        });

        await expect(authService.login({
            identifier: 'locked@example.com',
            password: 'password',
        })).rejects.toThrow('Account is locked. Please check your email to unlock it.');
    });

    it('passes rememberMe parameter during login down to session service', async () => {
        const tokenService = new TokenService('test-secret');
        const mockSession = {
            sessionId: 'sess-123',
            refreshToken: 'ref-123',
            accessToken: 'acc-123',
            userId: 'user-123',
            roles: ['Student'],
            tokenVersion: 1,
            createdAt: 12345,
            expiresAt: 67890,
        };
        const sessionService = {
            createSessionWithAccessJti: vi.fn().mockResolvedValue(mockSession),
        };
        const authDao = {
            authenticate: vi.fn().mockResolvedValue({
                userId: 'user-123',
                roles: ['Student'],
                tenantId: 'tenant-123',
                branchId: 'branch-123',
                tokenVersion: 1,
            }),
            isAccountLocked: vi.fn().mockResolvedValue(false),
        };
        const authService = new AuthService({
            tokenService,
            sessionService: sessionService as never,
            authDao: authDao as never,
        });

        await authService.login({
            identifier: 'test@example.com',
            password: 'password',
            rememberMe: true,
        });

        expect(sessionService.createSessionWithAccessJti).toHaveBeenCalledWith(
            expect.objectContaining({
                rememberMe: true,
            })
        );
    });
});