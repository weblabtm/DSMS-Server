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

        const controller = new AuthController(authService as never);
        const response = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        await controller.login({ body: { identifier: 'admin@example.com', password: 'secret' } } as never, response as never);

        expect(authService.login).toHaveBeenCalledWith({ identifier: 'admin@example.com', password: 'secret' });
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

        const controller = new AuthController(authService as never);
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

        const controller = new AuthController(authService as never);
        const response = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        await controller.register({ body: { identifier: 'student@example.com', password: 'secret' } } as never, response as never);

        expect(authService.register).toHaveBeenCalledWith({ identifier: 'student@example.com', password: 'secret' });
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

    it('logs out through the service and returns no content', () => {
        const authService = {
            login: vi.fn(),
            register: vi.fn(),
            refresh: vi.fn(),
            logout: vi.fn(),
        };

        const controller = new AuthController(authService as never);
        const response = {
            status: vi.fn().mockReturnThis(),
            send: vi.fn(),
        };

        controller.logout({ body: { refreshToken: 'refresh-1' } } as never, response as never);

        expect(authService.logout).toHaveBeenCalledWith({ refreshToken: 'refresh-1' });
        expect(response.status).toHaveBeenCalledWith(204);
        expect(response.send).toHaveBeenCalledTimes(1);
    });
});