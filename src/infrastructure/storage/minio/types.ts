import type { Readable } from 'node:stream';

export type StorageBucketPolicy = 'private' | 'public-read';

export interface MinioStorageConfig {
    endpoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    bucket: string;
    region: string;
    bucketPolicy: StorageBucketPolicy;
}

export interface UploadObjectInput {
    objectName: string;
    data: Buffer | string | Readable;
    size?: number;
    contentType?: string;
    metadata?: Record<string, string>;
}

export interface DownloadObjectInput {
    objectName: string;
}

export interface StorageHealthStatus {
    connected: boolean;
    error?: string;
}