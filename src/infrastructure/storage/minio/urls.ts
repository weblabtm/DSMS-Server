import type { Client as MinioClient } from 'minio';

import type { MinioStorageConfig } from './types.js';

export const createPublicObjectUrl = (config: MinioStorageConfig, objectName: string): string | null => {
    if (config.bucketPolicy !== 'public-read') {
        return null;
    }

    const protocol = config.useSSL ? 'https' : 'http';

    return `${protocol}://${config.endpoint}:${config.port}/${config.bucket}/${encodeURIComponent(objectName)}`;
};

export const createPresignedDownloadUrl = async (
    client: MinioClient,
    config: MinioStorageConfig,
    objectName: string,
    expirySeconds = 3600,
): Promise<string> => {
    const publicUrl = createPublicObjectUrl(config, objectName);

    if (publicUrl) {
        return publicUrl;
    }

    return client.presignedGetObject(config.bucket, objectName, expirySeconds);
};

export const createPresignedUploadUrl = async (
    client: MinioClient,
    config: MinioStorageConfig,
    objectName: string,
    expirySeconds = 3600,
): Promise<string> => {
    return client.presignedPutObject(config.bucket, objectName, expirySeconds);
};