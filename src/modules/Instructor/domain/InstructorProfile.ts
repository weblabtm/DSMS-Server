import { Role, type RoleName } from '../../Auth/domain/Role.js';
import { BaseUserProfile, type BaseUserProfileProps } from '../../User/domain/BaseUserProfile.js';

export class InstructorProfile extends BaseUserProfile {
    public constructor(props: Omit<BaseUserProfileProps, 'role'>) {
        super({
            ...props,
            role: new Role('Instructor'),
        });
    }

    public override canInviteRole(_roleName: RoleName): boolean {
        return false;
    }

    public override getInvitableRoles(): readonly RoleName[] {
        return [] as const;
    }
}
