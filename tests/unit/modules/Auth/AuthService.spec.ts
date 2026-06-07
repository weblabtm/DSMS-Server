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

    it('blocks login and throws CAPTCHA required if CAPTCHA token is missing', async () => {
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
        })).rejects.toThrow('CAPTCHA required');
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

    it('locks account temporarily on first failure threshold, then permanently with email link on second threshold', async () => {
        const tokenService = new TokenService('test-secret');
        const sessionService = new SessionService();
        const authDao = {
            authenticate: vi.fn().mockResolvedValue(null),
            isAccountLocked: vi.fn().mockResolvedValue(false),
            getUserLockStatus: vi.fn().mockResolvedValue({
                isLocked: false,
                lockedAt: null,
                unlockToken: null,
                unlockTokenExpiresAt: null,
                lockoutCount: 0,
                phoneNumber: null,
                reminder1hSent: false,
                reminder30mSent: false,
                reminder10mSent: false,
            }),
            lockAccountTemporarily: vi.fn().mockResolvedValue(undefined),
            incrementLockoutCount: vi.fn().mockResolvedValue(undefined),
            lockAccountPermanently: vi.fn().mockResolvedValue(undefined),
            lockAccount: vi.fn().mockResolvedValue(undefined),
        };
        const bruteForceService = {
            isIpBlocked: vi.fn().mockResolvedValue(false),
            registerFailure: vi.fn().mockResolvedValue({ ipBlocked: false, accountLocked: true, accountFailures: 5 }),
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

        // 1. First lock (lockoutCount is 0, so temporary lockout is triggered)
        await expect(authService.login({
            identifier: 'target@example.com',
            password: 'wrong-password',
            ipAddress: '1.2.3.4',
        })).rejects.toThrow('Your account has been locked. Try again in 15 minutes 0 seconds.');

        expect(bruteForceService.registerFailure).toHaveBeenCalledWith('1.2.3.4', 'target@example.com');
        expect(authDao.lockAccountTemporarily).toHaveBeenCalledWith('target@example.com', expect.any(Date));
        expect(authDao.incrementLockoutCount).toHaveBeenCalledWith('target@example.com');

        // 2. Second lock (lockoutCount is >= 1, so permanent lockout with email is triggered)
        authDao.getUserLockStatus.mockResolvedValue({
            isLocked: false,
            lockedAt: null,
            unlockToken: null,
            unlockTokenExpiresAt: null,
            lockoutCount: 1,
            phoneNumber: null,
            reminder1hSent: false,
            reminder30mSent: false,
            reminder10mSent: false,
        });

        await expect(authService.login({
            identifier: 'target@example.com',
            password: 'wrong-password',
            ipAddress: '1.2.3.4',
        })).rejects.toThrow('Account is locked. Please check your email to unlock it.');

        expect(authDao.lockAccountPermanently).toHaveBeenCalledWith('target@example.com', expect.any(String), expect.any(Date));
        expect(emailService.queueEmail).toHaveBeenCalledWith(
            'target@example.com',
            'Account Locked',
            expect.stringContaining('/auth/unlock?token='),
            undefined,
            undefined
        );
    });

    it('shows attempts left warning when consecutive failures reach 2 or more', async () => {
        const tokenService = new TokenService('test-secret');
        const sessionService = new SessionService();
        const authDao = {
            authenticate: vi.fn().mockResolvedValue(null),
            isAccountLocked: vi.fn().mockResolvedValue(false),
            getUserLockStatus: vi.fn().mockResolvedValue(null),
        };
        const bruteForceService = {
            isIpBlocked: vi.fn().mockResolvedValue(false),
            registerFailure: vi.fn().mockResolvedValue({ ipBlocked: false, accountLocked: false, accountFailures: 2 }),
        };
        const authService = new AuthService({
            tokenService,
            sessionService,
            authDao: authDao as never,
            bruteForceService: bruteForceService as never,
        });

        await expect(authService.login({
            identifier: 'target@example.com',
            password: 'wrong-password',
            ipAddress: '1.2.3.4',
        })).rejects.toThrow('Invalid credentials. 3 attempts left.');
    });

    it('automatically unlocks account if temporary lockout duration has passed', async () => {
        const tokenService = new TokenService('test-secret');
        const sessionService = new SessionService();
        const authDao = {
            authenticate: vi.fn().mockResolvedValue({ userId: 'user-1', roles: ['Student'] }),
            isAccountLocked: vi.fn().mockResolvedValue(false),
            getUserLockStatus: vi.fn().mockResolvedValue({
                isLocked: true,
                lockedAt: new Date(Date.now() - 20 * 60 * 1000), // locked 20 mins ago
                unlockToken: null, // temporary lockout
                unlockTokenExpiresAt: new Date(Date.now() - 5 * 60 * 1000), // expired 5 mins ago
                lockoutCount: 1,
                phoneNumber: null,
            }),
            unlockAccountAutomatically: vi.fn().mockResolvedValue(undefined),
            resetLockoutCount: vi.fn().mockResolvedValue(undefined),
            findByIdentifier: vi.fn().mockResolvedValue({
                userId: 'user-1',
                roles: ['Student'],
                phoneNumber: null,
            }),
        };
        const bruteForceService = {
            isIpBlocked: vi.fn().mockResolvedValue(false),
            registerSuccess: vi.fn().mockResolvedValue(undefined),
        };
        const authService = new AuthService({
            tokenService,
            sessionService,
            authDao: authDao as never,
            bruteForceService: bruteForceService as never,
        });

        const session = await authService.login({
            identifier: 'target@example.com',
            password: 'correct-password',
            ipAddress: '1.2.3.4',
        });

        expect(authDao.unlockAccountAutomatically).toHaveBeenCalledWith('target@example.com');
        expect(bruteForceService.registerSuccess).toHaveBeenCalledWith('1.2.3.4', 'target@example.com');
        expect(authDao.resetLockoutCount).toHaveBeenCalledWith('target@example.com');
        expect(session.userId).toBe('user-1');
    });

    it('blocks login if account is locked in database', async () => {
        const tokenService = new TokenService('test-secret');
        const sessionService = new SessionService();
        const authDao = {
            authenticate: vi.fn(),
            isAccountLocked: vi.fn().mockResolvedValue(true),
            getUserLockStatus: vi.fn().mockResolvedValue({
                isLocked: true,
                lockedAt: new Date(),
                unlockToken: 'some-token',
                unlockTokenExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
                lockoutCount: 1,
                phoneNumber: null,
            }),
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
            findByIdentifier: vi.fn().mockResolvedValue({
                userId: 'user-123',
                roles: ['Student'],
                tenantId: 'tenant-123',
                branchId: 'branch-123',
                tokenVersion: 1,
                phoneNumber: null,
            }),
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

    it('requires OTP verification if user has a phone number and has not verified OTP', async () => {
        const tokenService = new TokenService('test-secret');
        const sessionService = new SessionService();
        const authDao = {
            authenticate: vi.fn().mockResolvedValue({
                userId: 'user-123',
                roles: ['Student'],
            }),
            isAccountLocked: vi.fn().mockResolvedValue(false),
            findByIdentifier: vi.fn().mockResolvedValue({
                userId: 'user-123',
                roles: ['Student'],
                phoneNumber: '+94712345678',
            }),
        };
        const mfaTransactionStore = {
            createTransaction: vi.fn().mockResolvedValue('test-mfa-token'),
            getTransaction: vi.fn(),
            markVerified: vi.fn(),
            isVerified: vi.fn().mockResolvedValue(false),
            deleteTransaction: vi.fn(),
        };
        const authService = new AuthService({
            tokenService,
            sessionService,
            authDao: authDao as never,
            mfaTransactionStore: mfaTransactionStore as never,
        });

        try {
            await authService.login({
                identifier: 'mfa@example.com',
                password: 'password',
            });
            expect.fail('Should have thrown OTP required');
        } catch (error) {
            expect((error as any).message).toBe('OTP required');
            expect((error as any).mfaToken).toBe('test-mfa-token');
            expect((error as any).phoneNumber).toBe('+94712345678');
        }
        expect(mfaTransactionStore.createTransaction).toHaveBeenCalledWith('user-123', undefined);
    });

    it('proceeds with login if user provides a verified mfaToken', async () => {
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
            }),
            isAccountLocked: vi.fn().mockResolvedValue(false),
            findByIdentifier: vi.fn().mockResolvedValue({
                userId: 'user-123',
                roles: ['Student'],
                phoneNumber: '+94712345678',
            }),
        };
        const mfaTransactionStore = {
            createTransaction: vi.fn(),
            getTransaction: vi.fn().mockResolvedValue({ userId: 'user-123' }),
            markVerified: vi.fn(),
            isVerified: vi.fn().mockResolvedValue(true),
            deleteTransaction: vi.fn().mockResolvedValue(undefined),
        };
        const authService = new AuthService({
            tokenService,
            sessionService: sessionService as never,
            authDao: authDao as never,
            mfaTransactionStore: mfaTransactionStore as never,
        });

        const session = await authService.login({
            identifier: 'mfa@example.com',
            password: 'password',
            mfaToken: 'verified-token',
        });

        expect(session.userId).toBe('user-123');
        expect(mfaTransactionStore.isVerified).toHaveBeenCalledWith('verified-token');
        expect(mfaTransactionStore.deleteTransaction).toHaveBeenCalledWith('verified-token');
    });

    it('throws verification required if mfaToken is not verified', async () => {
        const tokenService = new TokenService('test-secret');
        const sessionService = new SessionService();
        const authDao = {
            authenticate: vi.fn().mockResolvedValue({
                userId: 'user-123',
                roles: ['Student'],
            }),
            isAccountLocked: vi.fn().mockResolvedValue(false),
            findByIdentifier: vi.fn().mockResolvedValue({
                userId: 'user-123',
                roles: ['Student'],
                phoneNumber: '+94712345678',
            }),
        };
        const mfaTransactionStore = {
            createTransaction: vi.fn(),
            getTransaction: vi.fn().mockResolvedValue({ userId: 'user-123' }),
            markVerified: vi.fn(),
            isVerified: vi.fn().mockResolvedValue(false),
            deleteTransaction: vi.fn(),
        };
        const authService = new AuthService({
            tokenService,
            sessionService,
            authDao: authDao as never,
            mfaTransactionStore: mfaTransactionStore as never,
        });

        await expect(authService.login({
            identifier: 'mfa@example.com',
            password: 'password',
            mfaToken: 'unverified-token',
        })).rejects.toThrow('MFA verification required');
        
        expect(mfaTransactionStore.isVerified).toHaveBeenCalledWith('unverified-token');
    });
});