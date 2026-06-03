/**
 * Value object for assigning a role to a user within a tenant/branch scope.
 */
import { type RoleName } from './Role.js';

export class UserRole {
    public constructor(
        public readonly userId: string,
        public readonly roleName: RoleName,
        public readonly tenantId?: string,
        public readonly branchId?: string,
    ) { }
}