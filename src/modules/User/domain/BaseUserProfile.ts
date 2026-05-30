import { Role, type RoleName } from '../../Auth/domain/Role.js';
import type { User } from './User.js';

export type BaseUserProfileProps = {
    id: string;
    displayName: string;
    email?: string;
    phone?: string;
    tenantId?: string;
    branchId?: string;
    role: Role;
};

export abstract class BaseUserProfile implements User {
    public readonly id: string;

    public readonly displayName: string;

    public readonly email?: string;

    public readonly phone?: string;

    public readonly tenantId?: string;

    public readonly branchId?: string;

    public readonly role: Role;

    protected constructor(props: BaseUserProfileProps) {
        this.id = props.id;
        this.displayName = props.displayName;
        this.email = props.email;
        this.phone = props.phone;
        this.tenantId = props.tenantId;
        this.branchId = props.branchId;
        this.role = props.role;
    }

    public canSelfRegister(): boolean {
        return false;
    }

    public canEnableMultiBranch(): boolean {
        return false;
    }

    public canInviteRole(_roleName: RoleName): boolean {
        return false;
    }

    public getInvitableRoles(): readonly RoleName[] {
        return [];
    }
}
