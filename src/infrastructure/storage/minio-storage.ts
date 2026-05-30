import { Client as MinioClient } from 'minio';
import { Readable } from 'node:stream';

import type { EnvironmentConfig } from '../../config/environment.js';

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

const PUBLIC_READ_ACTIONS = ['s3:GetObject'];

export const buildPublicReadBucketPolicy = (bucketName: string): string => {
    return JSON.stringify({
        Version: '2012-10-17',
        Statement: [
            {
                Sid: `PublicRead${bucketName}`,
                Effect: 'Allow',
                Principal: '*',
                Action: PUBLIC_READ_ACTIONS,
                Resource: [`arn:aws:s3:::${bucketName}/*`],
            },
        ],
    });
};

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

const collectStream = async (stream: Readable): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
};

const normalizeUploadData = (data: Buffer | string | Readable, size?: number): { payload: Buffer | Readable; payloadSize?: number } => {
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

export const ensureStorageBucket = async (client: MinioClient, config: MinioStorageConfig): Promise<void> => {
    const bucketExists = await client.bucketExists(config.bucket);

    if (!bucketExists) {
        await client.makeBucket(config.bucket, config.region);
    }

    if (config.bucketPolicy === 'public-read') {
        await client.setBucketPolicy(config.bucket, buildPublicReadBucketPolicy(config.bucket));
    }
};

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

export class MinioStorageService {
    private readonly config: MinioStorageConfig;

    private readonly client: MinioClient | null;

    private isReady = false;

    private lastError: string | null = null;

    public constructor(environment: EnvironmentConfig) {
        this.config = createStorageConfig(environment);
        this.client = createStorageClient(this.config);

        if (!this.client) {
            this.lastError = 'MinIO storage is not configured.';
            console.warn('Storage disabled: MinIO configuration is incomplete.');
        }
    }

    public isConfigured(): boolean {
        return this.client !== null;
    }

    public getConfig(): MinioStorageConfig {
        return this.config;
    }

    public async connect(): Promise<void> {
        if (!this.client) {
            return;
        }

        try {
            await ensureStorageBucket(this.client, this.config);
            this.isReady = true;
            this.lastError = null;
            console.log(`MinIO storage ready (${this.config.bucket})`);
        } catch (error) {
            this.isReady = false;
            this.lastError = error instanceof Error ? error.message : String(error);
            console.error('MinIO storage initialization failed. Continuing without storage.', error);
        }
    }

    public async disconnect(): Promise<void> {
        this.isReady = false;
    }

    public async getHealthStatus(): Promise<StorageHealthStatus> {
        if (!this.client) {
            return {
                connected: false,
                error: this.lastError ?? 'MinIO storage is not configured.',
            };
        }

        try {
            const bucketExists = await this.client.bucketExists(this.config.bucket);

            if (!bucketExists) {
                return {
                    connected: false,
                    error: `Bucket ${this.config.bucket} is missing.`,
                };
            }

            this.isReady = true;
            this.lastError = null;

            return { connected: true };
        } catch (error) {
            this.isReady = false;
            this.lastError = error instanceof Error ? error.message : String(error);

            return {
                connected: false,
                error: this.lastError,
            };
        }
    }

    public async uploadObject(input: UploadObjectInput): Promise<{ bucketName: string; objectName: string; etag?: string }> {
        if (!this.client) {
            throw new Error('MinIO storage is not configured.');
        }

        return uploadObject(this.client, this.config, input);
    }

    public async downloadObjectStream(input: DownloadObjectInput): Promise<Readable> {
        if (!this.client) {
            throw new Error('MinIO storage is not configured.');
        }

        return downloadObjectStream(this.client, this.config, input);
    }

    public async downloadObjectBuffer(input: DownloadObjectInput): Promise<Buffer> {
        if (!this.client) {
            throw new Error('MinIO storage is not configured.');
        }

        return downloadObjectBuffer(this.client, this.config, input);
    }

    public getPublicObjectUrl(objectName: string): string | null {
        return createPublicObjectUrl(this.config, objectName);
    }

    public async createDownloadUrl(objectName: string, expirySeconds = 3600): Promise<string> {
        if (!this.client) {
            throw new Error('MinIO storage is not configured.');
        }

        return createPresignedDownloadUrl(this.client, this.config, objectName, expirySeconds);
    }

    public async createUploadUrl(objectName: string, expirySeconds = 3600): Promise<string> {
        if (!this.client) {
            throw new Error('MinIO storage is not configured.');
        }

        return createPresignedUploadUrl(this.client, this.config, objectName, expirySeconds);
    }

    public getReadyState(): { ready: boolean; configured: boolean; error?: string } {
        return {
            ready: this.isReady,
            configured: this.client !== null,
            ...(this.lastError ? { error: this.lastError } : {}),
        };
    }
}