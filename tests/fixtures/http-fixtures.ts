import { TokenService, type IssueAccessTokenInput } from '../../src/modules/Auth/application/services/TokenService.js';
import type { RoleName } from '../../src/modules/Auth/domain/Role.js';

export type AuthHttpFixtures = {
    inviter: {
        subject: string;
        roles: readonly RoleName[];
        tenantId?: string;
        branchId?: string;
    };
    registration: {
        identifier: string;
        password: string;
        displayName: string;
    };
};

export type TenantHttpFixtures = {
    tenantAdmin: {
        identifier: string;
        password: string;
    };
    createTenant: {
        name: string;
        slug: string;
        tenantAdminIdentifier: string;
    };
};

export const createAuthHttpFixtures = (suffix: string): AuthHttpFixtures => ({
    inviter: {
        subject: `user-${suffix}`,
        roles: ['Tenant Admin'],
        tenantId: `tenant-${suffix}`,
    },
    registration: {
        identifier: `student-${suffix}@example.com`,
        password: 'Secret123!',
        displayName: `Student ${suffix}`,
    },
});

export const createTenantHttpFixtures = (suffix: string): TenantHttpFixtures => ({
    tenantAdmin: {
        identifier: `tenant-admin-${suffix}@example.com`,
        password: 'Admin123!',
    },
    createTenant: {
        name: `Tenant ${suffix}`,
        slug: `tenant-${suffix}`,
        tenantAdminIdentifier: `tenant-admin-${suffix}@example.com`,
    },
});

export const createBearerToken = (secret: string, input: IssueAccessTokenInput): string => {
    const tokenService = new TokenService(secret, { clock: () => Math.floor(Date.now() / 1000) });

    return tokenService.issueAccessToken(input);
};
