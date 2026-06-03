import 'dotenv/config';

import { EnvironmentConfig } from '../config/environment.js';
import { DatabaseConnection } from '../infrastructure/database/database-connection.js';
import { bootstrapSuperAdmin } from '../modules/Auth/infrastructure/SuperAdminBootstrap.js';

async function run(): Promise<void> {
    const env = EnvironmentConfig.fromProcessEnv();
    const db = new DatabaseConnection(env.databaseUrl);

    await db.connect();

    const prisma = db.getClient();

    if (!prisma) {
        throw new Error('Database client not configured; set DATABASE_URL.');
    }

    try {
        await bootstrapSuperAdmin(prisma as any);
    } finally {
        await db.disconnect();
    }
}

run().catch((error) => {
    console.error('Super Admin bootstrap failed', error instanceof Error ? error.message : String(error));
    process.exit(1);
});
