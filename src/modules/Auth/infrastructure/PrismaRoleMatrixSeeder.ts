import type { PrismaClient } from '../../../generated/prisma/client.js';
import { RoleMatrixSeeder } from './RoleMatrixSeeder.js';

export class PrismaRoleMatrixSeeder {
    public constructor(private readonly prisma: PrismaClient, private readonly seeder = new RoleMatrixSeeder()) { }

    public async seed(): Promise<void> {
        const snapshot = this.seeder.build();

        // Upsert permissions
        for (const key of snapshot.permissions) {
            const [moduleName, action, scope] = key.split(':');
            await (this.prisma as any).permission.upsert({
                where: { key },
                update: {},
                create: { key, moduleName, action, scope },
            });
        }

        // Upsert roles
        for (const role of snapshot.roles) {
            await (this.prisma as any).role.upsert({ where: { name: role.name }, update: {}, create: { name: role.name } });
        }

        // Upsert role-permissions (tenant/branch null)
        for (const rp of snapshot.rolePermissions) {
            const role = await (this.prisma as any).role.findUnique({ where: { name: rp.roleName } });
            const permission = await (this.prisma as any).permission.findUnique({ where: { key: rp.permissionKey } });

            if (!role || !permission) continue;

            // ensure unique combination exists
            const exists = await (this.prisma as any).rolePermission.findFirst({ where: { roleId: role.id, permissionId: permission.id, tenantId: null, branchId: null } });

            if (!exists) {
                await (this.prisma as any).rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
            }
        }
    }
}
