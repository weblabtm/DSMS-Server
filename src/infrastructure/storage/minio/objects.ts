import { Client as MinioClient } from 'minio';
import type { Readable } from 'node:stream';

import { collectStream, normalizeUploadData } from './streams.js';
import type { DownloadObjectInput, MinioStorageConfig, UploadObjectInput } from './types.js';

export const uploadObject = async (
    client: MinioClient,
    config: MinioStorageConfig,
    input: UploadObjectInput,
): Promise<{ bucketName: string; objectName: string; etag?: string }> => {
    const { payload, payloadSize } = normalizeUploadData(input.data, input.size);
    const metadata = {
        ...(input.metadata ?? {}),
        ...(input.contentType ? { 'Content-Type': input.contentType } : {}),
    };

    if (payloadSize === undefined) {
        throw new Error('A size is required when uploading a stream to MinIO.');
    }

    const result = await client.putObject(config.bucket, input.objectName, payload, payloadSize, metadata);

    return {
        bucketName: config.bucket,
        objectName: input.objectName,
        etag: typeof result === 'object' && result !== null && 'etag' in result ? String((result as { etag?: string }).etag) : undefined,
    };
};

export const downloadObjectStream = async (
    client: MinioClient,
    config: MinioStorageConfig,
    input: DownloadObjectInput,
): Promise<Readable> => {
    return client.getObject(config.bucket, input.objectName);
};

export const downloadObjectBuffer = async (
    client: MinioClient,
    config: MinioStorageConfig,
    input: DownloadObjectInput,
): Promise<Buffer> => {
    const stream = await downloadObjectStream(client, config, input);

    return collectStream(stream);
};