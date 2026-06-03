import type { Request, Response } from 'express';
import type { TenantService } from '../../application/services/TenantService.js';
import type { CreateTenantRequestDto, UpdateTenantRequestDto } from '../../application/dtos/TenantDtos.js';
import { ForbiddenError } from '../../../../shared/errors/ForbiddenError.js';

export class TenantController {
    public constructor(private readonly tenantService: TenantService) { }

    // POST /tenant/  - create tenant (requires existing tenant admin identifier)
    public async create(request: Request, response: Response): Promise<void> {
        const body = request.body as CreateTenantRequestDto;
        const authContext = request.authContext;

        if (!authContext || (!authContext.isSuperAdmin() && !authContext.hasRole('Tenant Admin'))) {
            response.status(403).json({ message: 'Only Super Admin or Tenant Admin can create tenants' });
            return;
        }

        if (!body?.name || !body?.slug || !body?.tenantAdminIdentifier) {
            response.status(400).json({ message: 'Missing required fields: name, slug and tenantAdminIdentifier' });
            return;
        }

        try {
            const tenant = await this.tenantService.createTenant({
                name: String(body.name),
                slug: String(body.slug),
                tenantAdminIdentifier: String(body.tenantAdminIdentifier),
            });

            response.status(201).json(tenant);
        } catch (error) {
            response.status(400).json({ message: error instanceof Error ? error.message : String(error) });
        }
    }

    // GET /tenant/:id
    public async get(request: Request, response: Response): Promise<void> {
        const authContext = request.authContext;
        if (!authContext) {
            response.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const id = String(request.params.id);

        // Fetch first so we can compare against both UUID and slug.
        // authContext.tenantId is the slug (set by TenantService at tenant creation time).
        const tenant = await this.tenantService.getTenant(id);

        if (!tenant) {
            response.status(404).json({ message: 'Tenant not found' });
            return;
        }

        const canAccess = authContext.isSuperAdmin()
            || authContext.tenantId === tenant.id
            || authContext.tenantId === tenant.slug;

        if (!canAccess) {
            throw new ForbiddenError('You do not have access to this tenant');
        }

        response.status(200).json(tenant);
    }

    // GET /tenant/
    public async list(request: Request, response: Response): Promise<void> {
        const authContext = request.authContext;
        if (!authContext) {
            response.status(401).json({ message: 'Unauthorized' });
            return;
        }

        if (!authContext.isSuperAdmin()) {
            throw new ForbiddenError('Only Super Admin can list all tenants');
        }

        const tenants = await this.tenantService.listTenants();
        response.status(200).json(tenants);
    }

    // GET /tenant/slug/:slug/availability
    public async checkSlugAvailability(request: Request, response: Response): Promise<void> {
        const slug = String(request.params.slug ?? '');

        const result = await this.tenantService.isSlugAvailable(slug);
        response.status(200).json(result);
    }

    // GET /tenant/slug/:slug
    public async getBySlug(request: Request, response: Response): Promise<void> {
        const authContext = request.authContext;
        if (!authContext) {
            response.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const slug = String(request.params.slug ?? '');

        const tenant = await this.tenantService.getTenantBySlug(slug);

        if (!tenant) {
            response.status(404).json({ message: 'Tenant not found' });
            return;
        }

        if (!authContext.isSuperAdmin() && authContext.tenantId !== tenant.id && authContext.tenantId !== tenant.slug) {
            throw new ForbiddenError('You do not have access to this tenant');
        }

        response.status(200).json(tenant);
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

        // Verify scope: authContext.tenantId is the slug; allow match against both UUID and slug.
        if (!authContext.isSuperAdmin()) {
            const existing = await this.tenantService.getTenant(id);
            const isSelfTenantAdmin = authContext.hasRole('Tenant Admin')
                && existing !== null
                && (authContext.tenantId === existing.id || authContext.tenantId === existing.slug);

            if (!isSelfTenantAdmin) {
                throw new ForbiddenError('Only Super Admin or the Tenant Admin of this tenant can update it');
            }
        }

        try {
            const updated = await this.tenantService.updateTenant(id, { name: body?.name ? String(body.name) : undefined, isActive: typeof body?.isActive === 'boolean' ? body.isActive : undefined });

            response.status(200).json(updated);
        } catch (error) {
            response.status(404).json({ message: error instanceof Error ? error.message : String(error) });
        }
    }
}
