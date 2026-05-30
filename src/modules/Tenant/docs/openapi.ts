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
                description: 'Creates a new tenant. Requires Super Admin or Tenant Admin. The request must include minimal tenant data and an existing `Tenant Admin` account identifier. The server links that account to the newly created tenant.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['name', 'tenantAdminIdentifier'],
                                properties: {
                                    name: { type: 'string' },
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
