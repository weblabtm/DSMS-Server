import { Role, type RoleName } from '../../Auth/domain/Role.js';
import { BaseUserProfile, type BaseUserProfileProps } from '../../User/domain/BaseUserProfile.js';

export class FrontDeskProfile extends BaseUserProfile {
    public constructor(props: Omit<BaseUserProfileProps, 'role'>) {
        super({
            ...props,
            role: new Role('Front Desk'),
        });
    }

    public override canInviteRole(roleName: RoleName): boolean {
        return roleName === 'Student';
    }

    public override getInvitableRoles(): readonly RoleName[] {
        return ['Student'] as const;
    }
}
