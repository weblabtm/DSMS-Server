import { Client as MinioClient } from 'minio';

import type { MinioStorageConfig } from './types.js';

export const isStorageConfigured = (config: MinioStorageConfig): boolean => {
    return Boolean(config.endpoint && config.accessKey && config.secretKey && config.bucket);
};

export const createStorageClient = (config: MinioStorageConfig): MinioClient | null => {
    if (!isStorageConfigured(config)) {
        return null;
    }

    return new MinioClient({
        endPoint: config.endpoint,
        port: config.port,
        useSSL: config.useSSL,
        accessKey: config.accessKey,
        secretKey: config.secretKey,
        region: config.region,
    });
};