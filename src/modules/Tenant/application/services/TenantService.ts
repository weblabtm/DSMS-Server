import { randomUUID } from 'crypto';
import type { TenantDao } from '../dao/TenantDao.js';
import type { AuthService } from '../../../Auth/application/services/AuthService.js';
import type { PrismaClient } from '../../../../generated/prisma/client.js';

export type CreateTenantInput = {
    name: string;
    adminAccount: {
        identifier: string;
        password: string;
    };
};

export class TenantService {
    public constructor(private readonly tenantDao: TenantDao, private readonly authService: AuthService, private readonly prismaClient?: PrismaClient) { }

    public async createTenant(input: CreateTenantInput) {
        const id = `tenant-${randomUUID()}`;

        if (this.prismaClient) {
            const created = await (this.prismaClient as any).tenant.create({ data: { id, name: input.name, isActive: true } });

            // create initial tenant admin account
            await this.authService.register({ identifier: input.adminAccount.identifier, password: input.adminAccount.password, tenantId: id, roles: ['Tenant Admin'] } as any);

            return {
                id: created.id,
                name: created.name,
                isActive: created.isActive,
                createdAt: new Date(created.createdAt as string),
                updatedAt: new Date(created.updatedAt as string),
            };
        }

        const tenant = await this.tenantDao.create({ id, name: input.name, isActive: true });

        // create initial tenant admin account
        await this.authService.register({
            identifier: input.adminAccount.identifier,
            password: input.adminAccount.password,
            tenantId: id,
            roles: ['Tenant Admin'],
        } as any);

        return tenant;
    }

    public async getTenant(id: string) {
        if (this.prismaClient) {
            const found = await (this.prismaClient as any).tenant.findUnique({ where: { id } });

            if (!found) return null;

            return {
                id: found.id,
                name: found.name,
                isActive: found.isActive,
                createdAt: new Date(found.createdAt as string),
                updatedAt: new Date(found.updatedAt as string),
            };
        }

        const t = await this.tenantDao.findById(id);

        if (!t) return null;

        return t;
    }

    public async listTenants() {
        if (this.prismaClient) {
            const rows = await (this.prismaClient as any).tenant.findMany();
            return rows.map((r: any) => ({ id: r.id, name: r.name, isActive: r.isActive, createdAt: new Date(r.createdAt as string), updatedAt: new Date(r.updatedAt as string) }));
        }

        return this.tenantDao.list();
    }

    public async updateTenant(id: string, patch: { name?: string; isActive?: boolean }) {
        // tenants cannot be deleted; allow name change and deactivate/reactivate
        if (this.prismaClient) {
            const updated = await (this.prismaClient as any).tenant.update({ where: { id }, data: { ...(patch.name ? { name: patch.name } : {}), ...(typeof patch.isActive === 'boolean' ? { isActive: patch.isActive } : {}) } });

            return {
                id: updated.id,
                name: updated.name,
                isActive: updated.isActive,
                createdAt: new Date(updated.createdAt as string),
                updatedAt: new Date(updated.updatedAt as string),
            };
        }

        const updated = await this.tenantDao.update(id, patch as any);
        return updated;
    }
}
