import { describe, expect, it } from 'vitest';

import { RoleMatrixSeeder } from '../../../../src/modules/Auth/infrastructure/RoleMatrixSeeder.js';

describe('RoleMatrixSeeder', () => {
    it('creates a seed snapshot from the permission catalog and role matrix', () => {
        const seeder = new RoleMatrixSeeder();
        const seed = seeder.build();

        expect(seed.roles.map((role) => role.name)).toContain('Super Admin');
        expect(seed.rolePermissions.some((entry) => entry.roleName === 'Student' && entry.permissionKey === 'student.viewOwn')).toBe(true);
        expect(seed.rolePermissions.some((entry) => entry.roleName === 'Student' && entry.permissionKey === 'tenant.manage')).toBe(false);
    });
});