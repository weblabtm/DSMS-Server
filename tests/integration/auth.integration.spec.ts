import { it, describe, expect } from 'vitest';

const shouldRun = Boolean(process.env.DATABASE_URL);
const maybe = shouldRun ? it : it.skip;

describe('Auth integration (DB-backed)', () => {
    maybe('registers and persists sessions with Prisma', async () => {
        const { EnvironmentConfig } = await import('../../../src/config/environment.js');
        const { DatabaseConnection } = await import('../../../src/infrastructure/database/database-connection.js');
        const { PrismaRoleMatrixSeeder } = await import('../../../src/modules/Auth/infrastructure/PrismaRoleMatrixSeeder.js');
        const { PrismaAuthDao } = await import('../../../src/modules/Auth/infrastructure/PrismaAuthDao.js');
        const { PrismaSessionService } = await import('../../../src/modules/Auth/infrastructure/PrismaSessionService.js');
        const { TokenService } = await import('../../../src/modules/Auth/application/services/TokenService.js');
        const { AuthService } = await import('../../../src/modules/Auth/application/services/AuthService.js');

        const env = EnvironmentConfig.fromProcessEnv();
        const db = new DatabaseConnection(env.databaseUrl);
        await db.connect();

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

        const session = await authService.register({ identifier: 'it-user@example.com', password: 'passw0rd' });

        expect(session.userId).toBeTruthy();
        expect(session.accessToken).toBeTruthy();

        // ensure session persisted
        const persisted = await (prisma as any).authSession.findUnique({ where: { id: session.sessionId } });
        expect(persisted).toBeDefined();

        await db.disconnect();
    });
});
