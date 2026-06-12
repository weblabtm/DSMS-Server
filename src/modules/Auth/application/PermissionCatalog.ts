/**
 * Central permission registry for the whole application.
 * Add new permission keys here first so guards, policies, and seeders stay consistent.
 */
import { Permission } from '../domain/Permission.js';

const DEFAULT_PERMISSIONS = [
    new Permission('auth.login', 'Auth', 'login', 'own'),
    new Permission('auth.refresh', 'Auth', 'refresh', 'own'),
    new Permission('tenant.manage', 'Tenant', 'manage', 'global'),
    new Permission('tenant.view', 'Tenant', 'view', 'tenant'),
    new Permission('user.view', 'User', 'view', 'tenant'),
    new Permission('user.manage', 'User', 'manage', 'tenant'),
    new Permission('settings.manage', 'Settings', 'manage', 'tenant'),
    new Permission('student.view', 'Student', 'view', 'branch'),
    new Permission('student.manage', 'Student', 'manage', 'branch'),
    new Permission('student.viewOwn', 'Student', 'viewOwn', 'own'),
    new Permission('instructor.view', 'Instructor', 'view', 'branch'),
    new Permission('instructor.manage', 'Instructor', 'manage', 'branch'),
    new Permission('batch.view', 'Batch', 'view', 'branch'),
    new Permission('batch.manage', 'Batch', 'manage', 'branch'),
    new Permission('scheduling.view', 'Scheduling', 'view', 'branch'),
    new Permission('scheduling.manage', 'Scheduling', 'manage', 'branch'),
    new Permission('attendance.view', 'Attendance', 'view', 'branch'),
    new Permission('attendance.mark', 'Attendance', 'mark', 'branch'),
    new Permission('exam.view', 'Exam', 'view', 'branch'),
    new Permission('exam.manage', 'Exam', 'manage', 'branch'),
    new Permission('payment.viewOwn', 'Payment', 'viewOwn', 'own'),
    new Permission('payment.manage', 'Payment', 'manage', 'branch'),
    new Permission('payroll.manage', 'Payroll', 'manage', 'tenant'),
    new Permission('report.view', 'Report', 'view', 'tenant'),
    new Permission('notification.manage', 'Notification', 'manage', 'branch'),
    new Permission('lead.manage', 'Lead', 'manage', 'branch'),
    new Permission('expense.manage', 'Expense', 'manage', 'branch'),
    new Permission('audit.view', 'Audit', 'view', 'tenant'),
    new Permission('progress.viewOwn', 'Progress', 'viewOwn', 'own'),
] as const;

/**
 * Read-only accessor for the canonical permission catalog.
 */
export class PermissionCatalog {
    private readonly permissions: Permission[];

    public constructor(permissions: readonly Permission[] = DEFAULT_PERMISSIONS) {
        this.permissions = [...permissions];
    }

    public all(): Permission[] {
        return [...this.permissions];
    }

    public findByKey(permissionKey: string): Permission | undefined {
        return this.permissions.find((permission) => permission.key === permissionKey);
    }

    public has(permissionKey: string): boolean {
        return this.findByKey(permissionKey) !== undefined;
    }
}
