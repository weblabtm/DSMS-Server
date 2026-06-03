import type { EnvironmentConfig } from '../../../config/environment.js';
import type { MinioStorageConfig } from './types.js';

export const createStorageConfig = (environment: EnvironmentConfig): MinioStorageConfig => ({
    endpoint: environment.minioEndpoint,
    port: environment.minioPort,
    useSSL: environment.minioUseSSL,
    accessKey: environment.minioAccessKey,
    secretKey: environment.minioSecretKey,
    bucket: environment.minioBucket,
    region: environment.minioRegion,
    bucketPolicy: environment.minioBucketPolicy,
});