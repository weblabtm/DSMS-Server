import { describe, expect, it } from 'vitest';

import { RoleMatrix } from '../../../../src/modules/Auth/application/RoleMatrix.js';

describe('RoleMatrix', () => {
    it('grants all permissions to Super Admin', () => {
        const roleMatrix = new RoleMatrix();

        expect(roleMatrix.can('Super Admin', 'tenant.manage')).toBe(true);
        expect(roleMatrix.can('Super Admin', 'payment.viewOwn')).toBe(true);
        expect(roleMatrix.can('Super Admin', 'progress.viewOwn')).toBe(true);
    });

    it('limits Student to self-service permissions', () => {
        const roleMatrix = new RoleMatrix();

        expect(roleMatrix.can('Student', 'progress.viewOwn')).toBe(true);
        expect(roleMatrix.can('Student', 'tenant.manage')).toBe(false);
        expect(roleMatrix.can('Student', 'payment.manage')).toBe(false);
    });

    it('lets Branch Manager manage operational branch work', () => {
        const roleMatrix = new RoleMatrix();

        expect(roleMatrix.can('Branch Manager', 'batch.manage')).toBe(true);
        expect(roleMatrix.can('Branch Manager', 'attendance.mark')).toBe(true);
        expect(roleMatrix.can('Branch Manager', 'tenant.manage')).toBe(false);
    });
});
