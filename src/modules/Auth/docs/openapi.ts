export const authOpenApi = {
    tags: [
        {
            name: 'Auth',
            description: 'Authentication and session management',
        },
    ],
    paths: {
        '/auth/register': {
            post: {
                tags: ['Auth'],
                summary: 'Register a new user',
                description: 'Creates a new user account. Self-registration is allowed only for `Tenant Admin` and must include `role: Tenant Admin`. All other roles require an authenticated inviter token.',
                security: [{}, { bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['identifier', 'password'],
                                properties: {
                                    identifier: { type: 'string', description: 'Email or username for the new account' },
                                    password: { type: 'string', description: 'Plain-text password (will be hashed by server)' },
                                    role: {
                                        type: 'string',
                                        nullable: true,
                                        enum: ['Super Admin', 'Tenant Admin', 'Branch Manager', 'Instructor', 'Front Desk', 'Student'],
                                        description: 'Required as `Tenant Admin` for self-registration. For inviter flows, this is validated against inviter policy.',
                                    },
                                    tenantId: { type: 'string', nullable: true, description: 'Optional at registration time. Typically assigned when a tenant is created and linked to this Tenant Admin account.' },
                                    branchId: { type: 'string', nullable: true, description: 'Optional branch scope for roles that support branch-level access.' },
                                },
                            },
                            examples: {
                                tenantAdminSelfRegistration: {
                                    summary: 'Tenant Admin self-registration (no token)',
                                    value: {
                                        identifier: 'admin@acme.com',
                                        password: 'StrongPass123!',
                                        role: 'Tenant Admin',
                                    },
                                },
                                invitedUserRegistration: {
                                    summary: 'Inviter-based registration (requires bearer token)',
                                    value: {
                                        identifier: 'frontdesk@acme.com',
                                        password: 'StrongPass123!',
                                        role: 'Front Desk',
                                        tenantId: 'tenant-123',
                                        branchId: 'branch-001',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'User registered and session created',
                    },
                    400: { description: 'Invalid payload' },
                    401: { description: 'Unauthorized - invalid token if Authorization header is provided' },
                    403: { description: 'Forbidden - self-registration denied for this role or inviter cannot create this role' },
                },
            },
        },
        '/auth/login': {
            post: {
                tags: ['Auth'],
                summary: 'Login and create a session',
                description: 'Authenticates a user and returns session tokens. `tenantId` and `branchId` are optional context filters and are not required for `Super Admin` login.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['identifier', 'password'],
                                properties: {
                                    identifier: { type: 'string', description: 'Email or username.' },
                                    password: { type: 'string', description: 'Account password.' },
                                    tenantId: { type: 'string', nullable: true, description: 'Optional tenant context filter. Not required for Super Admin.' },
                                    branchId: { type: 'string', nullable: true, description: 'Optional branch context filter. Not required for Super Admin.' },
                                },
                            },
                            examples: {
                                superAdminLogin: {
                                    summary: 'Super Admin login',
                                    value: {
                                        identifier: 'superadmin@email.com',
                                        password: 'your-password',
                                    },
                                },
                                tenantScopedLogin: {
                                    summary: 'Tenant-scoped login (optional context)',
                                    value: {
                                        identifier: 'tenantadmin@acme.com',
                                        password: 'your-password',
                                        tenantId: 'tenant-123',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Authenticated',
                    },
                    401: { description: 'Invalid credentials' },
                },
            },
        },
        '/auth/refresh': {
            post: {
                tags: ['Auth'],
                summary: 'Refresh access token',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['refreshToken'],
                                properties: {
                                    refreshToken: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Token refreshed' },
                    401: { description: 'Invalid refresh token' },
                },
            },
        },
        '/auth/logout': {
            post: {
                tags: ['Auth'],
                summary: 'Logout and revoke session',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['refreshToken'],
                                properties: {
                                    refreshToken: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    204: { description: 'Logged out' },
                },
            },
        },
    },
} as const;
