import { Role, type RoleName } from '../../Auth/domain/Role.js';
import { BaseUserProfile, type BaseUserProfileProps } from '../../User/domain/BaseUserProfile.js';

export class BranchManagerProfile extends BaseUserProfile {
    public constructor(props: Omit<BaseUserProfileProps, 'role'>) {
        super({
            ...props,
            role: new Role('Branch Manager'),
        });
    }

    public override canInviteRole(roleName: RoleName): boolean {
        return ['Instructor', 'Front Desk', 'Student'].includes(roleName);
    }

    public override getInvitableRoles(): readonly RoleName[] {
        return ['Instructor', 'Front Desk', 'Student'] as const;
    }
}
