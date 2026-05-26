/**
 * Minimal authorization guard for role-to-permission checks.
 * Controllers and services should call this instead of duplicating RBAC logic.
 */
import { ForbiddenError } from '../../../shared/errors/ForbiddenError.js';
import { type RoleName } from '../domain/Role.js';
import { RoleMatrix } from './RoleMatrix.js';

export class PermissionGuard {
    public constructor(private readonly roleMatrix: RoleMatrix = new RoleMatrix()) { }

    public can(roleName: RoleName, permissionKey: string): boolean {
        return this.roleMatrix.can(roleName, permissionKey);
    }

    public assertCan(roleName: RoleName, permissionKey: string): void {
        // Throw a typed authorization error so the API layer can return 403.
        if (!this.can(roleName, permissionKey)) {
            throw new ForbiddenError(`Role ${roleName} cannot perform ${permissionKey}`);
        }
    }
}
