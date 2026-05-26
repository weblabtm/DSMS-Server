import type { Role } from '../../Auth/domain/Role.js';

export interface User {
    readonly id: string;
    readonly displayName: string;
    readonly email?: string;
    readonly phone?: string;
    readonly tenantId?: string;
    readonly branchId?: string;
    readonly role: Role;
}
