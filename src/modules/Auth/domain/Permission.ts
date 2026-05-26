/**
 * RBAC permission value object.
 * This keeps the permission key, module, action, and scope in one place.
 */
export type PermissionScope = 'global' | 'tenant' | 'branch' | 'own';

/**
 * Permission is a value object that describes one allowed action.
 * The key is the stable identifier used by guards and seed data.
 */
export class Permission {
    public constructor(
        public readonly key: string,
        public readonly moduleName: string,
        public readonly action: string,
        public readonly scope: PermissionScope,
    ) { }
}
