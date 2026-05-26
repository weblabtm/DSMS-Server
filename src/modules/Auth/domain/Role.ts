export const ROLE_NAMES = [
    'Super Admin',
    'Tenant Admin',
    'Branch Manager',
    'Instructor',
    'Front Desk',
    'Student',
] as const;

/**
 * A strongly typed role name list used by RBAC and auth decisions.
 * Keep this list aligned with the roles supported by the business.
 */
export type RoleName = (typeof ROLE_NAMES)[number];

/**
 * Role is a lightweight value object.
 * It only stores identity and exposes equality for comparisons.
 */
export class Role {
    public constructor(public readonly name: RoleName) { }

    public equals(other: Role): boolean {
        return this.name === other.name;
    }
}
