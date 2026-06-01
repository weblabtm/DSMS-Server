export const tenantOpenApi = {
    tags: [
        {
            name: 'Tenant',
            description: 'Tenant management (create, list, get, update)',
        },
    ],
    paths: {
        '/tenant': {
            post: {
                tags: ['Tenant'],
                summary: 'Create a tenant',
                description: 'Creates a new tenant. Requires Super Admin or Tenant Admin. The request must include minimal tenant data, a unique tenant slug, and an existing `Tenant Admin` account identifier. The server links that account to the newly created tenant and persists the slug for wildcard routing.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['name', 'slug', 'tenantAdminIdentifier'],
                                properties: {
                                    name: { type: 'string' },
                                    slug: { type: 'string', description: 'Tenant slug used for wildcard subdomain routing.' },
                                    tenantAdminIdentifier: {
                                        type: 'string',
                                        description: 'Identifier of an existing account with role `Tenant Admin` that is not yet assigned to a tenant.',
                                    },
                                },
                            },
                            examples: {
                                createTenantWithExistingAdmin: {
                                    summary: 'Create tenant and attach existing Tenant Admin',
                                    value: {
                                        name: 'Acme Academy',
                                        slug: 'acme',
                                        tenantAdminIdentifier: 'admin@acme.com',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Tenant created' },
                    400: { description: 'Invalid payload' },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden - only Super Admin or Tenant Admin can create tenants' },
                },
            },
            get: {
                tags: ['Tenant'],
                summary: 'List tenants',
                responses: {
                    200: { description: 'List of tenants' },
                },
            },
        },
        '/tenant/slug/{slug}/availability': {
            get: {
                tags: ['Tenant'],
                summary: 'Check tenant slug availability',
                parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Slug availability result' } },
            },
        },
        '/tenant/slug/{slug}': {
            get: {
                tags: ['Tenant'],
                summary: 'Get tenant by slug',
                parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Tenant details' }, 404: { description: 'Not found' } },
            },
        },
        '/tenant/{id}': {
            get: {
                tags: ['Tenant'],
                summary: 'Get tenant',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Tenant details' }, 404: { description: 'Not found' } },
            },
            patch: {
                tags: ['Tenant'],
                summary: 'Update tenant (rename or activate/deactivate)',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, isActive: { type: 'boolean' } } } },
                    },
                },
                responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
            },
        },
    },
} as const;
