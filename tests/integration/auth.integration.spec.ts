import { it, describe, expect } from 'vitest';

import { createAuthHttpFixtures } from '../fixtures/http-fixtures.js';

const shouldRun = Boolean(process.env.DATABASE_URL);
const maybe = shouldRun ? it : it.skip;

describe('Auth integration (DB-backed)', () => {
    maybe('registers and persists sessions with Prisma', async () => {
        const { EnvironmentConfig } = await import('../../src/config/environment.js');
        const { DatabaseConnection } = await import('../../src/infrastructure/database/database-connection.js');
        const { PrismaRoleMatrixSeeder } = await import('../../src/modules/Auth/infrastructure/PrismaRoleMatrixSeeder.js');
        const { PrismaAuthDao } = await import('../../src/modules/Auth/infrastructure/PrismaAuthDao.js');
        const { PrismaSessionService } = await import('../../src/modules/Auth/infrastructure/PrismaSessionService.js');
        const { TokenService } = await import('../../src/modules/Auth/application/services/TokenService.js');
        const { AuthService } = await import('../../src/modules/Auth/application/services/AuthService.js');

        const env = EnvironmentConfig.fromProcessEnv();
        const db = new DatabaseConnection(env.databaseUrl);
        await db.connect();

        const fixtures = createAuthHttpFixtures(`auth-integration-${Date.now()}`);

        try {
            const prisma = db.getClient();
            if (!prisma) {
                throw new Error('DATABASE_URL not configured');
            }

            // seed RBAC
            const seeder = new PrismaRoleMatrixSeeder(prisma as any);
            await seeder.seed();

            const authDao = new PrismaAuthDao(prisma as any);
            const sessionService = new PrismaSessionService(prisma as any);
            const tokenService = new TokenService('integration-secret');
            const authService = new AuthService({ tokenService, sessionService, authDao } as never);

            const session = await authService.register({
                identifier: fixtures.registration.identifier,
                password: fixtures.registration.password,
                role: 'Student',
            }, 'Front Desk');

            expect(session.userId).toBeTruthy();
            expect(session.accessToken).toBeTruthy();
            expect(session.roles).toEqual(['Student']);

            // ensure session persisted
            const persisted = await (prisma as any).authSession.findUnique({ where: { id: session.sessionId } });
            expect(persisted).toBeDefined();

            const storedUser = await (prisma as any).authUser.findUnique({ where: { identifier: fixtures.registration.identifier } });
            expect(storedUser).toBeDefined();
        } finally {
            const prisma = db.getClient();
            if (prisma) {
                const user = await (prisma as any).authUser.findUnique({ where: { identifier: fixtures.registration.identifier } });
                if (user?.id) {
                    await (prisma as any).authSession.deleteMany({ where: { userId: user.id } });
                }
                await (prisma as any).authUser.deleteMany({ where: { identifier: fixtures.registration.identifier } });
            }

            await db.disconnect();
        }
    });
});
