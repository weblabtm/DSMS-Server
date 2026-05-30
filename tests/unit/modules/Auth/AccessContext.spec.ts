import { describe, expect, it } from 'vitest';

import { AccessContext } from '../../../../src/modules/Auth/domain/AccessContext.js';

describe('AccessContext', () => {
    it('tracks identity, roles, and scope checks', () => {
        const context = new AccessContext({
            userId: 'user-1',
            roles: ['Tenant Admin', 'Student'],
            tenantId: 'tenant-1',
            branchId: 'branch-1',
            tokenVersion: 3,
        });

        expect(context.userId).toBe('user-1');
        expect(context.roles).toEqual(['Tenant Admin', 'Student']);
        expect(context.tokenVersion).toBe(3);
        expect(context.hasRole('Student')).toBe(true);
        expect(context.hasRole('Super Admin')).toBe(false);
        expect(context.canAccessTenant('tenant-1')).toBe(true);
        expect(context.canAccessTenant('tenant-2')).toBe(false);
        expect(context.canAccessBranch('tenant-1', 'branch-1')).toBe(true);
        expect(context.canAccessBranch('tenant-1', 'branch-9')).toBe(false);
        expect(context.canAccessOwnResource('user-1')).toBe(true);
        expect(context.canAccessOwnResource('user-9')).toBe(false);
    });
});