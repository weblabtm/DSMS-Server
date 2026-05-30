import type { Client as MinioClient } from 'minio';

import { buildPublicReadBucketPolicy } from './policy.js';
import type { MinioStorageConfig } from './types.js';

export const ensureStorageBucket = async (client: MinioClient, config: MinioStorageConfig): Promise<void> => {
    const bucketExists = await client.bucketExists(config.bucket);

    if (!bucketExists) {
        await client.makeBucket(config.bucket, config.region);
    }

    if (config.bucketPolicy === 'public-read') {
        await client.setBucketPolicy(config.bucket, buildPublicReadBucketPolicy(config.bucket));
    }
};