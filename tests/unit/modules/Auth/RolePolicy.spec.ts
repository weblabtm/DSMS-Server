import { describe, expect, it } from 'vitest';

import { AccessContext } from '../../../../src/modules/Auth/domain/AccessContext.js';
import { RolePolicy } from '../../../../src/modules/Auth/application/policies/RolePolicy.js';

describe('RolePolicy', () => {
    it('allows scoped access only when permission and resource scope match', () => {
        const policy = new RolePolicy();
        const context = new AccessContext({
            userId: 'user-1',
            roles: ['Tenant Admin'],
            tenantId: 'tenant-1',
            branchId: 'branch-1',
        });

        expect(policy.canAccess('Tenant Admin', 'settings.manage', context, { tenantId: 'tenant-1' })).toBe(true);
        expect(policy.canAccess('Tenant Admin', 'settings.manage', context, { tenantId: 'tenant-2' })).toBe(false);
        expect(policy.canAccess('Student', 'student.viewOwn', context, { ownerUserId: 'user-1' })).toBe(true);
        expect(policy.canAccess('Student', 'student.viewOwn', context, { ownerUserId: 'user-2' })).toBe(false);
    });
});