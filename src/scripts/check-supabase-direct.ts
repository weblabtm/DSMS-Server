import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client.js';

const resolveDatabaseUrl = (): string | undefined => {
    const argUrl = process.argv[2]?.trim();
    if (argUrl) {
        return argUrl;
    }

    const envUrl = process.env.SUPABASE_DATABASE_URL?.trim() ?? process.env.DATABASE_URL?.trim();
    return envUrl || undefined;
};

const databaseUrl = resolveDatabaseUrl();

if (!databaseUrl) {
    console.error('Missing Supabase direct database URL. Pass it as the first argument or set SUPABASE_DATABASE_URL.');
    console.error('Usage: npm run check:supabase-direct -- "postgresql://user:password@host:5432/database?schema=public"');
    process.exit(1);
}

const run = async (): Promise<void> => {
    const client = new PrismaClient({
        adapter: new PrismaPg({ connectionString: databaseUrl }),
    });

    try {
        await client.$connect();
        await client.$queryRawUnsafe('SELECT 1');
        console.log('Supabase direct connection is healthy.');
    } catch (error) {
        console.error('Supabase direct connection check failed.');
        console.error(error);
        process.exitCode = 1;
    } finally {
        await client.$disconnect().catch(() => undefined);
    }
};

void run();