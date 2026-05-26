import type { Request, Response } from 'express';
import type { TenantService } from '../../application/services/TenantService.js';
import type { CreateTenantRequestDto, UpdateTenantRequestDto } from '../../application/dtos/TenantDtos.js';

export class TenantController {
    public constructor(private readonly tenantService: TenantService) { }

    // POST /tenant/  - create tenant (requires adminAccount in body)
    public async create(request: Request, response: Response): Promise<void> {
        const body = request.body as CreateTenantRequestDto;
        const authContext = request.authContext;

        if (!authContext?.isSuperAdmin()) {
            response.status(403).json({ message: 'Only Super Admin can create tenants' });
            return;
        }

        if (!body?.name || !body?.adminAccount?.identifier || !body?.adminAccount?.password) {
            response.status(400).json({ message: 'Missing required fields: name and adminAccount (identifier,password)' });
            return;
        }

        try {
            const tenant = await this.tenantService.createTenant({ name: String(body.name), adminAccount: { identifier: String(body.adminAccount.identifier), password: String(body.adminAccount.password) } });

            response.status(201).json(tenant);
        } catch (error) {
            response.status(500).json({ message: error instanceof Error ? error.message : String(error) });
        }
    }

    // GET /tenant/:id
    public async get(request: Request, response: Response): Promise<void> {
        const id = String(request.params.id);

        const tenant = await this.tenantService.getTenant(id);

        if (!tenant) {
            response.status(404).json({ message: 'Tenant not found' });
            return;
        }

        response.status(200).json(tenant);
    }

    // GET /tenant/
    public async list(_request: Request, response: Response): Promise<void> {
        const tenants = await this.tenantService.listTenants();
        response.status(200).json(tenants);
    }

    // PATCH /tenant/:id - update name or deactivate/reactivate
    public async update(request: Request, response: Response): Promise<void> {
        const id = String(request.params.id);
        const body = request.body as UpdateTenantRequestDto;
        const authContext = request.authContext;

        if (!authContext) {
            response.status(401).json({ message: 'Unauthorized' });
            return;
        }

        try {
            const updated = await this.tenantService.updateTenant(id, { name: body?.name ? String(body.name) : undefined, isActive: typeof body?.isActive === 'boolean' ? body.isActive : undefined });

            response.status(200).json(updated);
        } catch (error) {
            response.status(404).json({ message: error instanceof Error ? error.message : String(error) });
        }
    }
}
