import { randomUUID } from 'crypto';
import type { TenantDao } from '../dao/TenantDao.js';
import type { AuthService } from '../../../Auth/application/services/AuthService.js';

export type CreateTenantInput = {
    name: string;
    adminAccount: {
        identifier: string;
        password: string;
    };
};

export class TenantService {
    public constructor(private readonly tenantDao: TenantDao, private readonly authService: AuthService) { }

    public async createTenant(input: CreateTenantInput) {
        const id = `tenant-${randomUUID()}`;

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
        const t = await this.tenantDao.findById(id);

        if (!t) return null;

        return t;
    }

    public async listTenants() {
        return this.tenantDao.list();
    }

    public async updateTenant(id: string, patch: { name?: string; isActive?: boolean }) {
        // tenants cannot be deleted; allow name change and deactivate/reactivate
        const updated = await this.tenantDao.update(id, patch as any);
        return updated;
    }
}
