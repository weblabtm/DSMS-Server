import { Permission } from '../domain/Permission.js';
import { ROLE_NAMES, type RoleName } from '../domain/Role.js';
import { PermissionCatalog } from './PermissionCatalog.js';

/**
 * Hard-coded default mapping between each business role and its allowed permissions.
 * This is the first version of the RBAC matrix and can later move to database seeding.
 */
const ROLE_PERMISSION_KEYS: Record<Exclude<RoleName, 'Super Admin'>, readonly string[]> = {
    'Tenant Admin': [
        'tenant.manage',
        'user.view',
        'user.manage',
        'settings.manage',
        'student.view',
        'student.manage',
        'instructor.view',
        'instructor.manage',
        'batch.view',
        'batch.manage',
        'scheduling.view',
        'scheduling.manage',
        'attendance.view',
        'attendance.mark',
        'exam.view',
        'exam.manage',
        'payment.manage',
        'payroll.manage',
        'report.view',
        'notification.manage',
        'lead.manage',
        'expense.manage',
        'audit.view',
        'progress.viewOwn',
    ],
    'Branch Manager': [
        'user.view',
        'student.view',
        'student.manage',
        'instructor.view',
        'batch.view',
        'batch.manage',
        'scheduling.view',
        'scheduling.manage',
        'attendance.view',
        'attendance.mark',
        'exam.view',
        'exam.manage',
        'payment.manage',
        'report.view',
        'notification.manage',
        'lead.manage',
        'expense.manage',
    ],
    Instructor: [
        'student.view',
        'batch.view',
        'scheduling.view',
        'attendance.view',
        'attendance.mark',
        'exam.view',
        'report.view',
        'progress.viewOwn',
        'notification.manage',
    ],
    'Front Desk': [
        'student.view',
        'student.manage',
        'batch.view',
        'scheduling.view',
        'attendance.mark',
        'payment.manage',
        'lead.manage',
        'notification.manage',
    ],
    Student: [
        'student.viewOwn',
        'payment.viewOwn',
        'progress.viewOwn',
    ],
};

/**
 * Resolves which permissions belong to each role.
 * Super Admin always receives everything, while other roles are explicitly limited.
 */
export class RoleMatrix {
    public constructor(private readonly permissionCatalog: PermissionCatalog = new PermissionCatalog()) { }

    public permissionsFor(roleName: RoleName): Permission[] {
        // Super Admin bypasses the matrix and receives the full permission catalog.
        if (roleName === 'Super Admin') {
            return this.permissionCatalog.all();
        }

        // Unknown role names should never receive permissions.
        if (!ROLE_NAMES.includes(roleName)) {
            return [];
        }

        // Convert the stored permission keys into full permission objects.
        const permissionKeys = ROLE_PERMISSION_KEYS[roleName as Exclude<RoleName, 'Super Admin'>];

        return permissionKeys
            .map((permissionKey) => this.permissionCatalog.findByKey(permissionKey))
            .filter((permission): permission is Permission => permission !== undefined);
    }

    public can(roleName: RoleName, permissionKey: string): boolean {
        return this.permissionsFor(roleName).some((permission) => permission.key === permissionKey);
    }
}
