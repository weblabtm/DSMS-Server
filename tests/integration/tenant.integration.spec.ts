import { describe, expect, it } from 'vitest';

import { createAuthHttpFixtures, createTenantHttpFixtures } from '../fixtures/http-fixtures.js';

const shouldRun = Boolean(process.env.DATABASE_URL);
const maybe = shouldRun ? it : it.skip;

describe('Tenant integration (DB-backed)', () => {
    maybe('creates a tenant and the initial tenant admin with Prisma', async () => {
        const { EnvironmentConfig } = await import('../../src/config/environment.js');
        const { DatabaseConnection } = await import('../../src/infrastructure/database/database-connection.js');
        const { PrismaRoleMatrixSeeder } = await import('../../src/modules/Auth/infrastructure/PrismaRoleMatrixSeeder.js');
        const { PrismaAuthDao } = await import('../../src/modules/Auth/infrastructure/PrismaAuthDao.js');
        const { PrismaSessionService } = await import('../../src/modules/Auth/infrastructure/PrismaSessionService.js');
        const { TokenService } = await import('../../src/modules/Auth/application/services/TokenService.js');
        const { AuthService } = await import('../../src/modules/Auth/application/services/AuthService.js');
        const { InMemoryTenantDao } = await import('../../src/modules/Tenant/infrastructure/InMemoryTenantDao.js');
        const { TenantService } = await import('../../src/modules/Tenant/application/services/TenantService.js');

        const fixtures = createTenantHttpFixtures('tenant-integration');
        const authFixtures = createAuthHttpFixtures('tenant-integration');

        const env = EnvironmentConfig.fromProcessEnv();
        const db = new DatabaseConnection(env.databaseUrl);
        await db.connect();

        try {
            const prisma = db.getClient();
            if (!prisma) {
                throw new Error('DATABASE_URL not configured');
            }

            const seeder = new PrismaRoleMatrixSeeder(prisma as any);
            await seeder.seed();

            const authDao = new PrismaAuthDao(prisma as any);
            const sessionService = new PrismaSessionService(prisma as any);
            const tokenService = new TokenService('integration-secret');
            const authService = new AuthService({ tokenService, sessionService, authDao } as never);
            const tenantService = new TenantService(new InMemoryTenantDao() as never, authService, prisma as never);

            const tenant = await tenantService.createTenant({
                name: fixtures.createTenant.name,
                adminAccount: {
                    identifier: authFixtures.registration.identifier,
                    password: authFixtures.registration.password,
                },
            });

            expect(tenant.name).toBe(fixtures.createTenant.name);
            expect(tenant.isActive).toBe(true);

            const storedTenant = await (prisma as any).tenant.findUnique({ where: { id: tenant.id } });
            expect(storedTenant).toBeDefined();

            const storedAdmin = await (prisma as any).authUser.findUnique({ where: { identifier: authFixtures.registration.identifier } });
            expect(storedAdmin).toBeDefined();
            expect(storedAdmin.roles).toContain('Tenant Admin');
        } finally {
            await db.disconnect();
        }
    });
});
