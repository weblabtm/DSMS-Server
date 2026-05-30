import { randomUUID } from 'crypto';
import type { TenantDao } from '../dao/TenantDao.js';
import type { PrismaClient } from '../../../../generated/prisma/client.js';

export type CreateTenantInput = {
    name: string;
    tenantAdminIdentifier: string;
};

export class TenantService {
    public constructor(private readonly tenantDao: TenantDao, private readonly prismaClient?: PrismaClient) { }

    private getTenantDelegate(): any {
        const delegate = (this.prismaClient as any)?.tenant;

        if (!delegate) {
            throw new Error('Tenant model is not available in Prisma client. Run npm run prisma:generate and restart the server.');
        }

        return delegate;
    }

    public async createTenant(input: CreateTenantInput) {
        const id = `tenant-${randomUUID()}`;

        if (this.prismaClient) {
            const tenantDelegate = this.getTenantDelegate();
            const tenantAdmin = await (this.prismaClient as any).authUser.findUnique({
                where: { identifier: input.tenantAdminIdentifier },
            });

            if (!tenantAdmin) {
                throw new Error('Tenant Admin account not found');
            }

            if (!(tenantAdmin.roles ?? []).includes('Tenant Admin')) {
                throw new Error('Provided account is not a Tenant Admin');
            }

            if (tenantAdmin.tenantId) {
                throw new Error('Tenant Admin account is already assigned to a tenant');
            }

            const created = await tenantDelegate.create({ data: { id, name: input.name, isActive: true } });

            await (this.prismaClient as any).authUser.update({
                where: { id: tenantAdmin.id },
                data: { tenantId: id },
            });

            return {
                id: created.id,
                name: created.name,
                isActive: created.isActive,
                createdAt: new Date(created.createdAt as string),
                updatedAt: new Date(created.updatedAt as string),
            };
        }

        throw new Error('Tenant creation requires a database-backed Tenant Admin account lookup');
    }

    public async getTenant(id: string) {
        if (this.prismaClient) {
            const tenantDelegate = this.getTenantDelegate();
            const found = await tenantDelegate.findUnique({ where: { id } });

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
            const tenantDelegate = this.getTenantDelegate();
            const rows = await tenantDelegate.findMany();
            return rows.map((r: any) => ({ id: r.id, name: r.name, isActive: r.isActive, createdAt: new Date(r.createdAt as string), updatedAt: new Date(r.updatedAt as string) }));
        }

        return this.tenantDao.list();
    }

    public async updateTenant(id: string, patch: { name?: string; isActive?: boolean }) {
        // tenants cannot be deleted; allow name change and deactivate/reactivate
        if (this.prismaClient) {
            const tenantDelegate = this.getTenantDelegate();
            const updated = await tenantDelegate.update({ where: { id }, data: { ...(patch.name ? { name: patch.name } : {}), ...(typeof patch.isActive === 'boolean' ? { isActive: patch.isActive } : {}) } });

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
