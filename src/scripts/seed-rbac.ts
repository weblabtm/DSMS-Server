import 'dotenv/config';

import { EnvironmentConfig } from '../config/environment.js';
import { DatabaseConnection } from '../infrastructure/database/database-connection.js';

async function run() {
    const env = EnvironmentConfig.fromProcessEnv();
    const db = new DatabaseConnection(env.databaseUrl);

    await db.connect();

    const prisma = db.getClient();

    if (!prisma) {
        console.error('Database client not configured; set DATABASE_URL.');
        process.exit(1);
    }

    try {
        const { PrismaRoleMatrixSeeder } = await import('../modules/Auth/infrastructure/PrismaRoleMatrixSeeder.js');
        const seeder = new PrismaRoleMatrixSeeder(prisma as any);
        await seeder.seed();
        console.log('RBAC seeding complete');
    } catch (error) {
        console.error('RBAC seeding failed', error instanceof Error ? error.message : String(error));
        process.exit(1);
    } finally {
        await db.disconnect();
    }
}

run().catch((err) => {
    console.error('Seeder failed', err);
    process.exit(1);
});
