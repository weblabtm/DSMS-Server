import { describe, expect, it, vi } from 'vitest';

import { AuthController } from '../../../../src/modules/Auth/presentation/controllers/AuthController.js';

describe('AuthController', () => {
    it('maps login request and response DTOs through the service', async () => {
        const authService = {
            register: vi.fn(),
            login: vi.fn().mockResolvedValue({
                sessionId: 'session-1',
                refreshToken: 'refresh-1',
                accessToken: 'access-1',
                userId: 'user-1',
                roles: ['Tenant Admin'],
                tenantId: 'tenant-1',
                branchId: 'branch-1',
            }),
            refresh: vi.fn(),
        };

        const controller = new AuthController(authService as never, {} as never, {} as never);
        const response = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        await controller.login({ body: { identifier: 'admin@example.com', password: 'secret' } } as never, response as never);

        expect(authService.login).toHaveBeenCalledWith(expect.objectContaining({ identifier: 'admin@example.com', password: 'secret' }));
        expect(response.status).toHaveBeenCalledWith(200);
        expect(response.json).toHaveBeenCalledWith({
            sessionId: 'session-1',
            refreshToken: 'refresh-1',
            accessToken: 'access-1',
            userId: 'user-1',
            roles: ['Tenant Admin'],
            tenantId: 'tenant-1',
            branchId: 'branch-1',
        });
    });

    it('returns 401 for invalid login credentials', async () => {
        const authService = {
            register: vi.fn(),
            login: vi.fn().mockRejectedValue(new Error('Invalid credentials')),
            refresh: vi.fn(),
        };

        const controller = new AuthController(authService as never, {} as never, {} as never);
        const response = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        await controller.login({ body: { identifier: 'missing@example.com', password: 'wrong' } } as never, response as never);

        expect(response.status).toHaveBeenCalledWith(401);
        expect(response.json).toHaveBeenCalledWith({ message: 'Invalid credentials' });
    });

    it('maps refresh request dto through the service', async () => {
        const authService = {
            register: vi.fn(),
            login: vi.fn(),
            refresh: vi.fn().mockResolvedValue({
                sessionId: 'session-2',
                refreshToken: 'refresh-2',
                accessToken: 'access-2',
                userId: 'user-1',
                roles: ['Tenant Admin'],
            }),
        };

        const controller = new AuthController(authService as never, {} as never, {} as never);
        const response = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        await controller.refresh({ body: { refreshToken: 'refresh-1' } } as never, response as never);

        expect(authService.refresh).toHaveBeenCalledWith({ refreshToken: 'refresh-1' });
        expect(response.status).toHaveBeenCalledWith(200);
    });

    it('maps register request and returns created session data', async () => {
        const authService = {
            login: vi.fn(),
            register: vi.fn().mockResolvedValue({
                sessionId: 'session-3',
                refreshToken: 'refresh-3',
                accessToken: 'access-3',
                userId: 'user-2',
                roles: ['Student'],
                tenantId: 'tenant-1',
                branchId: 'branch-1',
            }),
            refresh: vi.fn(),
            logout: vi.fn(),
        };

        const controller = new AuthController(authService as never, {} as never, {} as never);
        const response = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        await controller.register({ body: { identifier: 'student@example.com', password: 'secret', role: 'Student' }, authContext: { roles: ['Front Desk'] } } as never, response as never);

        expect(authService.register).toHaveBeenCalledWith({ identifier: 'student@example.com', password: 'secret', role: 'Student' }, 'Front Desk');
        expect(response.status).toHaveBeenCalledWith(201);
        expect(response.json).toHaveBeenCalledWith({
            sessionId: 'session-3',
            refreshToken: 'refresh-3',
            accessToken: 'access-3',
            userId: 'user-2',
            roles: ['Student'],
            tenantId: 'tenant-1',
            branchId: 'branch-1',
        });
    });

    it('logs out through the service and returns no content', async () => {
        const authService = {
            login: vi.fn(),
            register: vi.fn(),
            refresh: vi.fn(),
            logout: vi.fn(),
        };

        const controller = new AuthController(authService as never, {} as never, {} as never);
        const response = {
            status: vi.fn().mockReturnThis(),
            send: vi.fn(),
        };

        await controller.logout({ body: { refreshToken: 'refresh-1' } } as never, response as never);

        expect(authService.logout).toHaveBeenCalledWith({ refreshToken: 'refresh-1' });
        expect(response.status).toHaveBeenCalledWith(204);
        expect(response.send).toHaveBeenCalledTimes(1);
    });

    describe('OTP endpoints', () => {
        it('generateOtp: fails when CAPTCHA is invalid', async () => {
            const googleCaptchaValidator = {
                validate: vi.fn().mockResolvedValue(false),
            };
            const controller = new AuthController({} as never, {} as never, googleCaptchaValidator as never);
            const response = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };

            await controller.generateOtp(
                { body: { email: 't@e.com', captchaToken: 'bad' }, ip: '1.1.1.1', headers: {} } as never,
                response as never
            );

            expect(googleCaptchaValidator.validate).toHaveBeenCalledWith('bad', '1.1.1.1');
            expect(response.status).toHaveBeenCalledWith(400);
            expect(response.json).toHaveBeenCalledWith({ message: 'Invalid CAPTCHA token' });
        });

        it('generateOtp: generates OTP and sets cookie when CAPTCHA is valid', async () => {
            const googleCaptchaValidator = {
                validate: vi.fn().mockResolvedValue(true),
            };
            const otpService = {
                generateOtp: vi.fn().mockResolvedValue({ token: 'test-token', otp: '123456' }),
            };
            const controller = new AuthController({} as never, otpService as never, googleCaptchaValidator as never);
            const response = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
                cookie: vi.fn(),
            };

            await controller.generateOtp(
                { body: { email: 't@e.com', captchaToken: 'good' }, ip: '1.1.1.1', headers: {} } as never,
                response as never
            );

            expect(otpService.generateOtp).toHaveBeenCalledWith({
                email: 't@e.com',
                phoneNumber: undefined,
                tenantId: undefined,
                branchId: undefined,
            });
            expect(response.cookie).toHaveBeenCalledWith('otp_token', 'test-token', expect.any(Object));
            expect(response.status).toHaveBeenCalledWith(200);
            expect(response.json).toHaveBeenCalledWith({
                message: 'OTP generated successfully.',
                token: 'test-token',
            });
        });

        it('validateOtp: validates OTP successfully and clears cookie', async () => {
            const otpService = {
                validateOtp: vi.fn().mockResolvedValue(true),
            };
            const controller = new AuthController({} as never, otpService as never, {} as never);
            const response = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
                clearCookie: vi.fn(),
            };

            await controller.validateOtp(
                { body: { otp: '123456' }, cookies: { otp_token: 'test-token' }, headers: {} } as never,
                response as never
            );

            expect(otpService.validateOtp).toHaveBeenCalledWith('test-token', '123456');
            expect(response.clearCookie).toHaveBeenCalledWith('otp_token');
            expect(response.status).toHaveBeenCalledWith(200);
            expect(response.json).toHaveBeenCalledWith({ message: 'OTP verified successfully.' });
        });

        it('validateOtp: returns error if OTP token is missing', async () => {
            const controller = new AuthController({} as never, {} as never, {} as never);
            const response = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };

            await controller.validateOtp(
                { body: { otp: '123456' }, cookies: {}, headers: {} } as never,
                response as never
            );

            expect(response.status).toHaveBeenCalledWith(400);
            expect(response.json).toHaveBeenCalledWith({ message: 'OTP token is missing.' });
        });
    });
});