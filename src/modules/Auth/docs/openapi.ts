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
                summary: 'Register a new user (inviter-only)',
                description: 'Creates a new user account. This endpoint requires an authenticated inviter; the server derives `tenantId` and `role` from the inviter context. Clients MUST NOT supply `role` or `tenantId`.',
                security: [{ bearerAuth: [] }],
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
                                    displayName: { type: 'string', nullable: true, description: 'Optional display name' },
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
                    401: { description: 'Unauthorized - inviter required' },
                    403: { description: 'Forbidden - inviter cannot create this role' },
                },
            },
        },
        '/auth/login': {
            post: {
                tags: ['Auth'],
                summary: 'Login and create a session',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['identifier', 'password'],
                                properties: {
                                    identifier: { type: 'string' },
                                    password: { type: 'string' },
                                    tenantId: { type: 'string', nullable: true },
                                    branchId: { type: 'string', nullable: true },
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
