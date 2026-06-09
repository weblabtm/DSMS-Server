/**
 * Request-scoped authorization context.
 * Carries the authenticated user identity and scope used by policies.
 */
import { type RoleName } from './Role.js';

export type AccessContextInput = {
    userId: string;
    roles: readonly RoleName[];
    tenantId?: string;
    branchId?: string;
    tokenVersion?: number;
    accessTokenJti?: string;
};

export type ResourceScope = {
    tenantId?: string;
    branchId?: string;
    ownerUserId?: string;
};

export class AccessContext {
    public readonly userId: string;

    public readonly roles: RoleName[];

    public readonly tenantId?: string;

    public readonly branchId?: string;

    public readonly tokenVersion: number;

    public readonly accessTokenJti?: string;

    public constructor(input: AccessContextInput) {
        this.userId = input.userId;
        this.roles = [...input.roles];
        this.tenantId = input.tenantId;
        this.branchId = input.branchId;
        this.tokenVersion = input.tokenVersion ?? 0;
        this.accessTokenJti = input.accessTokenJti;
    }

    public hasRole(roleName: RoleName): boolean {
        return this.roles.includes(roleName);
    }

    public isSuperAdmin(): boolean {
        return this.hasRole('Super Admin');
    }

    public canAccessTenant(tenantId?: string): boolean {
        if (this.isSuperAdmin()) {
            return true;
        }

        if (!tenantId || !this.tenantId) {
            return false;
        }

        return this.tenantId === tenantId;
    }

    public canAccessBranch(tenantId?: string, branchId?: string): boolean {
        if (this.isSuperAdmin()) {
            return true;
        }

        if (!branchId) {
            return false;
        }

        return this.canAccessTenant(tenantId) && this.branchId === branchId;
    }

    public canAccessOwnResource(ownerUserId?: string): boolean {
        if (this.isSuperAdmin()) {
            return true;
        }

        return ownerUserId !== undefined && ownerUserId === this.userId;
    }
}