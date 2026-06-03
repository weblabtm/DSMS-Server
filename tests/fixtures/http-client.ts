import { request as httpRequest } from 'node:http';
import { URL } from 'node:url';

export type HttpJsonRequestOptions = {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
};

export type HttpJsonResponse = {
    statusCode: number;
    body: unknown;
    text: string;
};

export const requestJson = async (url: string, options: HttpJsonRequestOptions = {}): Promise<HttpJsonResponse> => {
    const target = new URL(url);
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);

    return await new Promise<HttpJsonResponse>((resolve, reject) => {
        const request = httpRequest(
            {
                method: options.method ?? 'GET',
                hostname: target.hostname,
                port: target.port,
                path: `${target.pathname}${target.search}`,
                headers: {
                    accept: 'application/json',
                    ...(body !== undefined
                        ? {
                            'content-type': 'application/json',
                            'content-length': Buffer.byteLength(body).toString(),
                        }
                        : {}),
                    ...(options.headers ?? {}),
                },
            },
            (response) => {
                const chunks: Buffer[] = [];

                response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
                response.on('end', () => {
                    const text = Buffer.concat(chunks).toString('utf8');

                    if (!text) {
                        resolve({
                            statusCode: response.statusCode ?? 0,
                            body: undefined,
                            text,
                        });
                        return;
                    }

                    try {
                        resolve({
                            statusCode: response.statusCode ?? 0,
                            body: JSON.parse(text),
                            text,
                        });
                    } catch {
                        resolve({
                            statusCode: response.statusCode ?? 0,
                            body: text,
                            text,
                        });
                    }
                });
            },
        );

        request.on('error', reject);

        if (body !== undefined) {
            request.write(body);
        }

        request.end();
    });
};