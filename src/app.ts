import express from 'express';

import { environment } from './config/environment.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = new Set(environment.allowedOrigins);

app.use((request, response, next) => {
    const origin = request.headers.origin;

    if (typeof origin === 'string' && (allowedOrigins.has('*') || allowedOrigins.has(origin))) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Vary', 'Origin');
    }

    response.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (request.method === 'OPTIONS') {
        response.sendStatus(204);
        return;
    }

    next();
});

app.get('/health', (_request, response) => {
    response.status(200).json({
        status: 'ok',
        message: 'Server is running',
    });
});

app.use((_request, response) => {
    response.status(404).json({
        message: 'Route not found',
    });
});

export default app;
