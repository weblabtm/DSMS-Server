import bcrypt from 'bcryptjs';

import type { PrismaClient } from '../../../generated/prisma/client.js';

const isEnabled = (value: string | undefined): boolean => String(value ?? '').toLowerCase() === 'true';

export async function bootstrapSuperAdmin(prisma: PrismaClient, env: NodeJS.ProcessEnv = process.env): Promise<void> {
    if (!isEnabled(env.ENABLE_SUPER_ADMIN_BOOTSTRAP)) {
        console.log('Super Admin bootstrap skipped (ENABLE_SUPER_ADMIN_BOOTSTRAP is not true).');
        return;
    }

    const identifier = String(env.SUPER_ADMIN_IDENTIFIER ?? '').trim();
    const password = String(env.SUPER_ADMIN_PASSWORD ?? '');

    if (!identifier || !password) {
        throw new Error('SUPER_ADMIN_IDENTIFIER and SUPER_ADMIN_PASSWORD are required when ENABLE_SUPER_ADMIN_BOOTSTRAP=true');
    }

    const existing = await (prisma as any).authUser.findUnique({ where: { identifier } });

    if (existing) {
        const roles: string[] = existing.roles ?? [];

        if (roles.includes('Super Admin')) {
            if (!existing.phoneNumber) {
                await (prisma as any).authUser.update({
                    where: { identifier },
                    data: { phoneNumber: '+94000000000' }
                });
                console.log(`Updated Super Admin with test phone number: +94712345678`);
            }
            console.log(`Super Admin already exists for identifier: ${identifier}`);
            return;
        }

        throw new Error(`Identifier ${identifier} already exists without Super Admin role. Manual intervention required.`);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await (prisma as any).authUser.create({
        data: {
            identifier,
            password: hashedPassword,
            roles: ['Super Admin'],
            phoneNumber: '+94712345678',
        },
    });

    console.log(`Super Admin bootstrap completed for identifier: ${identifier}`);
}
