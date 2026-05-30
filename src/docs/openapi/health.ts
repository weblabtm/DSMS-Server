export const healthOpenApi = {
    paths: {
        '/health': {
            get: {
                tags: ['Health'],
                summary: 'Health check',
                responses: {
                    200: {
                        description: 'Server is running',
                    },
                    503: {
                        description: 'A dependency is unavailable',
                    },
                },
            },
        },
    },
} as const;
