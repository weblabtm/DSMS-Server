import { describe, expect, it, vi } from 'vitest';

import { AuthController } from '../../../../src/modules/Auth/presentation/controllers/AuthController.js';

describe('AuthController', () => {
    it('maps login request and response DTOs through the service', async () => {
        const authService = {
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
});