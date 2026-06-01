import { describe, expect, it } from 'vitest';

import { createTenantHttpFixtures } from '../fixtures/http-fixtures.js';

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

        const fixtures = createTenantHttpFixtures(`tenant-integration-${Date.now()}`);

        const env = EnvironmentConfig.fromProcessEnv();
        const db = new DatabaseConnection(env.databaseUrl);
        await db.connect();

        let createdTenantId: string | undefined;

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

            await authService.register({
                identifier: fixtures.tenantAdmin.identifier,
                password: fixtures.tenantAdmin.password,
                role: 'Tenant Admin',
            });

            const tenantService = new TenantService(new InMemoryTenantDao() as never, prisma as never);

            const tenant = await tenantService.createTenant({
                name: fixtures.createTenant.name,
                slug: fixtures.createTenant.slug,
                tenantAdminIdentifier: fixtures.tenantAdmin.identifier,
            });

            createdTenantId = tenant.id;

            expect(tenant.name).toBe(fixtures.createTenant.name);
            expect(tenant.isActive).toBe(true);

            const storedTenant = await (prisma as any).tenant.findUnique({ where: { id: tenant.id } });
            expect(storedTenant).toBeDefined();

            const storedAdmin = await (prisma as any).authUser.findUnique({ where: { identifier: fixtures.tenantAdmin.identifier } });
            expect(storedAdmin).toBeDefined();
            expect(storedAdmin.roles).toContain('Tenant Admin');
            expect(storedAdmin.tenantId).toBe(tenant.slug);
        } finally {
            const prisma = db.getClient();
            if (prisma) {
                const user = await (prisma as any).authUser.findUnique({ where: { identifier: fixtures.tenantAdmin.identifier } });
                if (user?.id) {
                    await (prisma as any).authSession.deleteMany({ where: { userId: user.id } });
                }

                if (createdTenantId) {
                    await (prisma as any).tenant.deleteMany({ where: { id: createdTenantId } });
                }

                await (prisma as any).authUser.deleteMany({ where: { identifier: fixtures.tenantAdmin.identifier } });
            }

            await db.disconnect();
        }
    });
});
