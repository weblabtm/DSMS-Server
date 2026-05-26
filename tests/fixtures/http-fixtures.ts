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
    createTenant: {
        name: string;
        adminAccount: {
            identifier: string;
            password: string;
        };
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
    createTenant: {
        name: `Tenant ${suffix}`,
        adminAccount: {
            identifier: `tenant-admin-${suffix}@example.com`,
            password: 'Admin123!',
        },
    },
});

export const createBearerToken = (secret: string, input: IssueAccessTokenInput): string => {
    const tokenService = new TokenService(secret, { clock: () => Math.floor(Date.now() / 1000) });

    return tokenService.issueAccessToken(input);
};
