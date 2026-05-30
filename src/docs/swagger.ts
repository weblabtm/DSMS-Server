import type { Express, Request, Response } from 'express';

import { openApiDocument } from './openapi/index.js';

const SWAGGER_UI_CSS_CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css';
const SWAGGER_UI_BUNDLE_CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js';
const SWAGGER_UI_STANDALONE_PRESET_CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js';

const renderSwaggerHtml = (): string => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DSMS API Docs</title>
    <link rel="stylesheet" href="${SWAGGER_UI_CSS_CDN}" />
    <style>
        html, body {
            margin: 0;
            padding: 0;
            background: #fafafa;
        }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="${SWAGGER_UI_BUNDLE_CDN}" crossorigin="anonymous"></script>
    <script src="${SWAGGER_UI_STANDALONE_PRESET_CDN}" crossorigin="anonymous"></script>
    <script>
        window.onload = function () {
            window.ui = SwaggerUIBundle({
                url: '/openapi.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset,
                ],
                layout: 'BaseLayout',
                persistAuthorization: true,
            });
        };
    </script>
</body>
</html>`;

const sendSwaggerHtml = (_request: Request, response: Response): void => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.status(200).send(renderSwaggerHtml());
};

export const registerSwaggerDocs = (app: Express): void => {
    app.get('/docs', sendSwaggerHtml);
    app.get('/docs/', sendSwaggerHtml);

    app.get('/openapi.json', (_request, response) => {
        response.json(openApiDocument);
    });
};
