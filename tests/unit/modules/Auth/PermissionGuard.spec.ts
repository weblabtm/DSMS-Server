import { describe, expect, it } from 'vitest';

import { ForbiddenError } from '../../../../src/shared/errors/ForbiddenError.js';
import { PermissionGuard } from '../../../../src/modules/Auth/application/PermissionGuard.js';

describe('PermissionGuard', () => {
    it('allows permitted actions', () => {
        const guard = new PermissionGuard();

        expect(() => guard.assertCan('Tenant Admin', 'settings.manage')).not.toThrow();
    });

    it('rejects forbidden actions', () => {
        const guard = new PermissionGuard();

        expect(() => guard.assertCan('Student', 'tenant.manage')).toThrow(ForbiddenError);
    });
});
