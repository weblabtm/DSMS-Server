/**
 * Value object representing one role-to-permission mapping.
 * Useful for seeding and for keeping persistence rows explicit.
 */
import { type RoleName } from './Role.js';

export class RolePermission {
    public constructor(
        public readonly roleName: RoleName,
        public readonly permissionKey: string,
    ) { }
}