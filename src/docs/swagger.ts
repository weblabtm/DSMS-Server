import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

import { openApiDocument } from './openapi/index.js';

export const registerSwaggerDocs = (app: Express): void => {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, {
        swaggerOptions: {
            persistAuthorization: true,
        },
    }));

    app.get('/docs', (_request, response) => {
        response.redirect('/docs/');
    });

    app.get('/openapi.json', (_request, response) => {
        response.json(openApiDocument);
    });
};
