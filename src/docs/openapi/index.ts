import { authOpenApi } from '../../modules/Auth/docs/openapi.js';
import { tenantOpenApi } from '../../modules/Tenant/docs/openapi.js';
import { healthOpenApi } from './health.js';
import { mergeOpenApiDocuments } from './merge.js';

export const openApiDocument = mergeOpenApiDocuments(
    {
        openapi: '3.0.3',
        info: {
            title: 'DSMS Server API',
            version: '1.0.0',
            description: 'Module-driven OpenAPI documentation for API testing.',
        },
        servers: [
            {
                url: '/',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
    },
    healthOpenApi,
    authOpenApi,
    tenantOpenApi,
);
