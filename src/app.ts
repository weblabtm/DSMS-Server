import express from 'express';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
