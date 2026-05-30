import { describe, expect, it } from 'vitest';

import { SuperAdminProfile } from '../../../../src/modules/Super Admin/domain/SuperAdminProfile.js';
import { TenantAdminProfile } from '../../../../src/modules/Tenant/domain/TenantAdminProfile.js';
import { BranchManagerProfile } from '../../../../src/modules/BranchManager/domain/BranchManagerProfile.js';
import { InstructorProfile } from '../../../../src/modules/Instructor/domain/InstructorProfile.js';
import { FrontDeskProfile } from '../../../../src/modules/FrontDesk/domain/FrontDeskProfile.js';
import { StudentProfile } from '../../../../src/modules/Student/domain/StudentProfile.js';

describe('role profiles', () => {
    it('keeps Super Admin invitation-only and tenant scoped', () => {
        const profile = new SuperAdminProfile({
            id: 'sa-1',
            displayName: 'Super Admin',
            email: 'sa@example.com',
        });

        expect(profile.role.name).toBe('Super Admin');
        expect(profile.canSelfRegister()).toBe(false);
        expect(profile.canInviteRole('Tenant Admin')).toBe(true);
        expect(profile.canInviteRole('Student')).toBe(false);
    });

    it('lets Tenant Admin enable multi-branch and invite lower roles', () => {
        const profile = new TenantAdminProfile({
            id: 'ta-1',
            displayName: 'Tenant Admin',
            email: 'ta@example.com',
            tenantId: 'tenant-1',
        });

        expect(profile.role.name).toBe('Tenant Admin');
        expect(profile.canEnableMultiBranch()).toBe(true);
        expect(profile.canInviteRole('Branch Manager')).toBe(true);
        expect(profile.canInviteRole('Student')).toBe(true);
    });

    it('lets Branch Manager invite instructor, front desk, and student only', () => {
        const profile = new BranchManagerProfile({
            id: 'bm-1',
            displayName: 'Branch Manager',
            email: 'bm@example.com',
            tenantId: 'tenant-1',
            branchId: 'branch-1',
        });

        expect(profile.role.name).toBe('Branch Manager');
        expect(profile.canInviteRole('Instructor')).toBe(true);
        expect(profile.canInviteRole('Front Desk')).toBe(true);
        expect(profile.canInviteRole('Tenant Admin')).toBe(false);
    });

    it('keeps Instructor and Student invitation-limited', () => {
        const instructor = new InstructorProfile({
            id: 'ins-1',
            displayName: 'Instructor',
            email: 'ins@example.com',
            tenantId: 'tenant-1',
            branchId: 'branch-1',
        });

        const student = new StudentProfile({
            id: 'stu-1',
            displayName: 'Student',
            email: 'stu@example.com',
            tenantId: 'tenant-1',
            branchId: 'branch-1',
        });

        expect(instructor.canInviteRole('Student')).toBe(false);
        expect(student.canSelfRegister()).toBe(false);
        expect(student.canInviteRole('Student')).toBe(false);
    });

    it('limits Front Desk to student invitations only', () => {
        const profile = new FrontDeskProfile({
            id: 'fd-1',
            displayName: 'Front Desk',
            email: 'fd@example.com',
            tenantId: 'tenant-1',
            branchId: 'branch-1',
        });

        expect(profile.canInviteRole('Student')).toBe(true);
        expect(profile.canInviteRole('Instructor')).toBe(false);
    });
});
