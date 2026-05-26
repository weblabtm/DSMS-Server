import { Role, type RoleName } from '../../Auth/domain/Role.js';
import { BaseUserProfile, type BaseUserProfileProps } from '../../User/domain/BaseUserProfile.js';

export class SuperAdminProfile extends BaseUserProfile {
    public constructor(props: Omit<BaseUserProfileProps, 'role'>) {
        super({
            ...props,
            role: new Role('Super Admin'),
        });
    }

    public override canInviteRole(roleName: RoleName): boolean {
        return roleName === 'Tenant Admin';
    }

    public override getInvitableRoles() {
        return ['Tenant Admin'] as const;
    }
}
