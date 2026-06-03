import { describe, expect, it, vi } from 'vitest';

import { AuthenticationMiddleware } from '../../../../src/modules/Auth/application/middleware/AuthenticationMiddleware.js';
import { TokenService } from '../../../../src/modules/Auth/application/services/TokenService.js';

describe('AuthenticationMiddleware', () => {
    it('attaches an access context when the bearer token is valid', async () => {
        const tokenService = new TokenService('test-secret', { clock: () => 1_700_000_000 });
        const middleware = new AuthenticationMiddleware(tokenService);
        const token = tokenService.issueAccessToken({
            subject: 'user-1',
            roles: ['Tenant Admin'],
            tenantId: 'tenant-1',
            branchId: 'branch-1',
            tokenVersion: 4,
        });

        const request = {
            headers: {
                authorization: `Bearer ${token}`,
            },
        };
        const response = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
        const next = vi.fn();

        await middleware.handle(request as never, response as never, next);

        expect(next).toHaveBeenCalledOnce();
        expect((request as { authContext?: { userId: string } }).authContext?.userId).toBe('user-1');
    });

    it('returns 401 when the bearer token is missing or invalid', async () => {
        const tokenService = new TokenService('test-secret');
        const middleware = new AuthenticationMiddleware(tokenService);
        const request = { headers: {} };
        const response = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
        const next = vi.fn();

        await middleware.handle(request as never, response as never, next);

        expect(response.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });
});