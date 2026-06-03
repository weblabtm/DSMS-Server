/**
 * Policy layer for scope-aware authorization decisions.
 * It combines permission checks with tenant/branch/self scope rules.
 */
import { AccessContext, type ResourceScope } from '../../domain/AccessContext.js';
import { type RoleName } from '../../domain/Role.js';
import { PermissionCatalog } from '../PermissionCatalog.js';
import { PermissionGuard } from '../PermissionGuard.js';

export class RolePolicy {
    public constructor(
        private readonly permissionCatalog: PermissionCatalog = new PermissionCatalog(),
        private readonly permissionGuard: PermissionGuard = new PermissionGuard(),
    ) { }

    public canAccess(roleName: RoleName, permissionKey: string, context: AccessContext, resource: ResourceScope = {}): boolean {
        if (!this.permissionGuard.can(roleName, permissionKey)) {
            return false;
        }

        const permission = this.permissionCatalog.findByKey(permissionKey);

        if (!permission) {
            return false;
        }

        switch (permission.scope) {
            case 'global':
                return true;
            case 'tenant':
                return context.canAccessTenant(resource.tenantId);
            case 'branch':
                return context.canAccessBranch(resource.tenantId ?? context.tenantId, resource.branchId);
            case 'own':
                return context.canAccessOwnResource(resource.ownerUserId);
            default:
                return false;
        }
    }

    public assertCanAccess(roleName: RoleName, permissionKey: string, context: AccessContext, resource: ResourceScope = {}): void {
        if (!this.canAccess(roleName, permissionKey, context, resource)) {
            throw new Error(`Role ${roleName} cannot access ${permissionKey}`);
        }
    }
}