import { describe, expect, it } from 'vitest';
import { tenantContext } from '../../src/shared/utils/TenantContext.js';

const shouldRun = Boolean(process.env.DATABASE_URL);
const maybe = shouldRun ? it : it.skip;

describe('Database Tenant Isolation Integration', () => {
    maybe('automatically isolates Prisma queries based on active TenantContext', async () => {
        const { EnvironmentConfig } = await import('../../src/config/environment.js');
        const { DatabaseConnection } = await import('../../src/infrastructure/database/database-connection.js');

        const env = EnvironmentConfig.fromProcessEnv();
        const db = new DatabaseConnection(env.databaseUrl);
        await db.connect();

        const prisma = db.getClient();
        if (!prisma) {
            throw new Error('DATABASE_URL not configured');
        }

        const tenantA = `tenant-a-${Date.now()}`;
        const tenantB = `tenant-b-${Date.now()}`;
        
        let userAId: string | undefined;
        let userBId: string | undefined;

        try {
            // 1. Create test users under distinct tenants without context (simulating seeds/cron privileges)
            const userA = await (prisma as any).authUser.create({
                data: {
                    identifier: `user-a-${Date.now()}@example.com`,
                    password: 'hashed-password-123',
                    tenantId: tenantA,
                    roles: ['Student']
                }
            });
            userAId = userA.id;

            const userB = await (prisma as any).authUser.create({
                data: {
                    identifier: `user-b-${Date.now()}@example.com`,
                    password: 'hashed-password-123',
                    tenantId: tenantB,
                    roles: ['Student']
                }
            });
            userBId = userB.id;

            // 2. Query globally (no active context) -> should find both users
            const allUsers = await (prisma as any).authUser.findMany({
                where: {
                    id: { in: [userAId, userBId] }
                }
            });
            expect(allUsers).toHaveLength(2);

            // 3. Query under Tenant A Context -> should only find User A
            await tenantContext.run(tenantA, async () => {
                // findMany check
                const scopedUsers = await (prisma as any).authUser.findMany({
                    where: {
                        id: { in: [userAId, userBId] }
                    }
                });
                expect(scopedUsers).toHaveLength(1);
                expect(scopedUsers[0].id).toBe(userAId);
                expect(scopedUsers[0].tenantId).toBe(tenantA);

                // findUnique lookup of User B (translated to findFirst + scoped to Tenant A) -> should return null
                const scopedUserB = await (prisma as any).authUser.findUnique({
                    where: { id: userBId }
                });
                expect(scopedUserB).toBeNull();
            });

            // 4. Query under Tenant B Context -> should only find User B
            await tenantContext.run(tenantB, async () => {
                const scopedUsers = await (prisma as any).authUser.findMany({
                    where: {
                        id: { in: [userAId, userBId] }
                    }
                });
                expect(scopedUsers).toHaveLength(1);
                expect(scopedUsers[0].id).toBe(userBId);
                expect(scopedUsers[0].tenantId).toBe(tenantB);
            });

            // 5. Write Violation Check -> Tenant A context should not be allowed to modify Tenant B records
            await tenantContext.run(tenantA, async () => {
                await expect(
                    (prisma as any).authUser.update({
                        where: { id: userBId },
                        data: { roles: ['Tenant Admin'] }
                    })
                ).rejects.toThrow(/Tenant Isolation Breach/);

                await expect(
                    (prisma as any).authUser.delete({
                        where: { id: userBId }
                    })
                ).rejects.toThrow(/Tenant Isolation Breach/);
            });

        } finally {
            // Clean up without context (global permissions)
            if (userAId) {
                await (prisma as any).authUser.deleteMany({ where: { id: userAId } });
            }
            if (userBId) {
                await (prisma as any).authUser.deleteMany({ where: { id: userBId } });
            }
            await db.disconnect();
        }
    });
});
