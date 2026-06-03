import { Readable } from 'node:stream';

export const collectStream = async (stream: Readable): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
};

export const normalizeUploadData = (
    data: Buffer | string | Readable,
    size?: number,
): { payload: Buffer | Readable; payloadSize?: number } => {
    if (typeof data === 'string') {
        const payload = Buffer.from(data);

        return {
            payload,
            payloadSize: payload.length,
        };
    }

    if (Buffer.isBuffer(data)) {
        return {
            payload: data,
            payloadSize: data.length,
        };
    }

    return {
        payload: data,
        payloadSize: size,
    };
};