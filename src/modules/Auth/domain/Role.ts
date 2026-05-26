/**
 * Canonical role names used by the RBAC system.
 * Keep this list aligned with the business roles and seed data.
 */
export const ROLE_NAMES = [
    'Super Admin',
    'Tenant Admin',
    'Branch Manager',
    'Instructor',
    'Front Desk',
    'Student',
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

/**
 * Lightweight role value object for comparisons and identity checks.
 */
export class Role {
    public constructor(public readonly name: RoleName) { }

    public equals(other: Role): boolean {
        return this.name === other.name;
    }
}
