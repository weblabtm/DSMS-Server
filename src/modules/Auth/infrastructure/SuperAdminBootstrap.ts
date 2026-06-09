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
    const phoneNumber = String(env.SUPER_ADMIN_PHONE_NUMBER ?? '0763080469').trim();

    if (!identifier || !password) {
        throw new Error('SUPER_ADMIN_IDENTIFIER and SUPER_ADMIN_PASSWORD are required when ENABLE_SUPER_ADMIN_BOOTSTRAP=true');
    }

    const existing = await (prisma as any).authUser.findUnique({ where: { identifier } });

    if (existing) {
        const roles: string[] = existing.roles ?? [];

        if (roles.includes('Super Admin')) {
            if (!existing.phoneNumber || existing.phoneNumber !== phoneNumber) {
                await (prisma as any).authUser.update({
                    where: { identifier },
                    data: { phoneNumber }
                });
                console.log(`Updated Super Admin with phone number: ${phoneNumber}`);
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
            phoneNumber,
        },
    });

    console.log(`Super Admin bootstrap completed for identifier: ${identifier}`);
}
