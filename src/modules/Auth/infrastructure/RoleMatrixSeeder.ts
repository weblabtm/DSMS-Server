/**
 * Builds a seed snapshot for roles and role-permission mappings.
 * This keeps initial RBAC records aligned with the canonical catalog and matrix.
 */
import { PermissionCatalog } from '../application/PermissionCatalog.js';
import { RoleMatrix } from '../application/RoleMatrix.js';
import { type RoleName } from '../domain/Role.js';
import { RolePermission } from '../domain/RolePermission.js';

export type SeedRole = {
    name: RoleName;
};

export type SeedRolePermission = {
    roleName: RoleName;
    permissionKey: string;
};

export type SeedSnapshot = {
    roles: SeedRole[];
    permissions: string[];
    rolePermissions: SeedRolePermission[];
};

export class RoleMatrixSeeder {
    public constructor(
        private readonly permissionCatalog: PermissionCatalog = new PermissionCatalog(),
        private readonly roleMatrix: RoleMatrix = new RoleMatrix(permissionCatalog),
    ) { }

    public build(): SeedSnapshot {
        const roleNames: RoleName[] = [
            'Super Admin',
            'Tenant Admin',
            'Branch Manager',
            'Instructor',
            'Front Desk',
            'Student',
        ];

        const roles: SeedRole[] = roleNames.map((name) => ({ name }));

        const permissions = this.permissionCatalog.all().map((permission) => permission.key);
        const rolePermissions = roles.flatMap((role) => this.roleMatrix.permissionsFor(role.name).map((permission) => new RolePermission(role.name, permission.key)));

        return {
            roles,
            permissions,
            rolePermissions: rolePermissions.map((entry) => ({
                roleName: entry.roleName,
                permissionKey: entry.permissionKey,
            })),
        };
    }
}