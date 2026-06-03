import { describe, expect, it } from 'vitest';

import { TokenService } from '../../../../src/modules/Auth/application/services/TokenService.js';

describe('TokenService', () => {
    it('issues and verifies signed access tokens', () => {
        const tokenService = new TokenService('test-secret', {
            issuer: 'dsms-server',
            clock: () => 1_700_000_000,
            accessTokenTtlSeconds: 3_600,
        });

        const token = tokenService.issueAccessToken({
            subject: 'user-1',
            roles: ['Tenant Admin'],
            tenantId: 'tenant-1',
            branchId: 'branch-1',
            tokenVersion: 7,
        });

        const claims = tokenService.verifyAccessToken(token);

        expect(claims.sub).toBe('user-1');
        expect(claims.roles).toEqual(['Tenant Admin']);
        expect(claims.tenantId).toBe('tenant-1');
        expect(claims.branchId).toBe('branch-1');
        expect(claims.tokenVersion).toBe(7);
        expect(claims.issuer).toBe('dsms-server');
    });

    it('rejects tampered access tokens', () => {
        const tokenService = new TokenService('test-secret');
        const token = tokenService.issueAccessToken({
            subject: 'user-1',
            roles: ['Student'],
        });
        const tamperedToken = `${token}x`;

        expect(() => tokenService.verifyAccessToken(tamperedToken)).toThrow();
    });
});