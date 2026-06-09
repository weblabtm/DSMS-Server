#!/usr/bin/env node
import 'dotenv/config';
import { DatabaseConnection } from '../src/infrastructure/database/database-connection.js';

function usage() {
    console.log('Usage: npm run remove-tenant -- <identifier> [--confirm] [--force]');
    console.log('  <identifier>   email or identifier of the AuthUser to remove');
    console.log('  --confirm      actually perform deletions (without this it is a dry-run)');
    console.log('  --force        when deleting tenant, force delete even if other users exist');
}

async function main() {
    const argv = process.argv.slice(2);
    if (argv.length === 0) {
        usage();
        process.exit(1);
    }

    const identifier = argv[0];
    const flags = new Set(argv.slice(1));
    const npmConfirm = String(process.env.npm_config_confirm ?? '').trim().toLowerCase();
    const doConfirm = flags.has('--confirm') || npmConfirm === 'true' || npmConfirm === '1';
    const doForce = flags.has('--force');
    const databaseUrlArgument = argv.find((entry) => entry.startsWith('--database-url='))?.split('=', 2)[1]?.trim() ?? null;
    const databaseUrlIndex = argv.indexOf('--database-url');
    const databaseUrlFromNextArg = databaseUrlIndex >= 0 ? argv[databaseUrlIndex + 1]?.trim() ?? null : null;
    const databaseUrl = databaseUrlArgument ?? databaseUrlFromNextArg ?? process.env.SUPABASE_DATABASE_URL?.trim() ?? process.env.DATABASE_URL?.trim() ?? '';

    const conn = new DatabaseConnection(databaseUrl);
    await conn.connect();
    const prisma = conn.getClient();
    if (!prisma) {
        console.error('Prisma client is not configured. Aborting.');
        process.exit(2);
    }

    let user;
    try {
        user = await prisma.authUser.findFirst({ where: { identifier } });
    } catch (error) {
        console.error('Database query failed while reading AuthUser.');
        console.error(`Connection URL source: ${databaseUrlArgument ? '--database-url' : databaseUrlFromNextArg ? '--database-url (next arg)' : process.env.SUPABASE_DATABASE_URL ? 'SUPABASE_DATABASE_URL' : 'DATABASE_URL'}`);
        console.error(error);
        await conn.disconnect();
        process.exit(5);
    }
    if (!user) {
        console.error(`No AuthUser found for identifier: ${identifier}`);
        await conn.disconnect();
        process.exit(3);
    }

    let tenant = null;
    if (user.tenantId) {
        tenant = await prisma.tenant.findFirst({
            where: { id: user.tenantId },
            select: { id: true, name: true, isActive: true },
        });
    }

    const sessionCount = await prisma.authSession.count({ where: { userId: user.id } });
    const rolesCount = await prisma.userRole.count({ where: { userId: user.id } });

    let otherTenantUsers = 0;
    if (tenant) {
        otherTenantUsers = await prisma.authUser.count({ where: { tenantId: tenant.id, NOT: { id: user.id } } });
    }

    console.log('--- Remove Tenant Account Report ---');
    console.log('Target user: ', { id: user.id, identifier: user.identifier, tenantId: user.tenantId });
    console.log('AuthSessions to remove:', sessionCount);
    console.log('UserRole entries to remove for user:', rolesCount);
    if (tenant) {
        console.log('Associated tenant:', { id: tenant.id, name: tenant.name, isActive: tenant.isActive });
        console.log('Other users in tenant (excluding this user):', otherTenantUsers);
    } else {
        console.log('No associated tenant found for this user.');
    }

    if (!doConfirm) {
        console.log('\nDry-run only. No changes have been made. Re-run with --confirm to apply.');
        await conn.disconnect();
        process.exit(0);
    }

    console.log('\n--confirm provided. Proceeding with deletion.');

    try {
        await prisma.$transaction(async (tx) => {
            await tx.authSession.deleteMany({ where: { userId: user.id } });
            await tx.userRole.deleteMany({ where: { userId: user.id } });
            await tx.authUser.delete({ where: { id: user.id } });

            if (tenant) {
                const remaining = await tx.authUser.count({ where: { tenantId: tenant.id } });
                if (remaining > 0 && !doForce) {
                    throw new Error(`Tenant ${tenant.id} still has ${remaining} user(s). Use --force to remove tenant anyway.`);
                }

                if (doForce) {
                    await tx.rolePermission.deleteMany({ where: { tenantId: tenant.id } });
                    await tx.userRole.deleteMany({ where: { tenantId: tenant.id } });
                }

                await tx.tenant.delete({ where: { id: tenant.id } });
                console.log(`Tenant ${tenant.id} deleted.`);
            }
        });

        console.log('Deletion transaction completed successfully.');
    } catch (error) {
        console.error('Error during deletion transaction:', error instanceof Error ? error.message : String(error));
        console.error('No partial changes should have been committed (transaction rolled back).');
        await conn.disconnect();
        process.exit(4);
    }

    await conn.disconnect();
    console.log('Done.');
}

main().catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(99);
});
