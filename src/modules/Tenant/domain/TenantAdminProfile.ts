import { Role, type RoleName } from '../../Auth/domain/Role.js';
import { BaseUserProfile, type BaseUserProfileProps } from '../../User/domain/BaseUserProfile.js';

export class TenantAdminProfile extends BaseUserProfile {
    public constructor(props: Omit<BaseUserProfileProps, 'role'>) {
        super({
            ...props,
            role: new Role('Tenant Admin'),
        });
    }

    public override canEnableMultiBranch(): boolean {
        return true;
    }

    public override canInviteRole(roleName: RoleName): boolean {
        return ['Branch Manager', 'Instructor', 'Front Desk', 'Student'].includes(roleName);
    }

    public override getInvitableRoles(): readonly RoleName[] {
        return ['Branch Manager', 'Instructor', 'Front Desk', 'Student'] as const;
    }
}
