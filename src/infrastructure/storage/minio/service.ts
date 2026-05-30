import { Client as MinioClient } from 'minio';
import type { Readable } from 'node:stream';

import type { EnvironmentConfig } from '../../../config/environment.js';
import { createStorageConfig } from './config.js';
import { createStorageClient } from './client.js';
import { ensureStorageBucket } from './bucket.js';
import { downloadObjectBuffer, downloadObjectStream, uploadObject } from './objects.js';
import { createPresignedDownloadUrl, createPresignedUploadUrl, createPublicObjectUrl } from './urls.js';
import type { DownloadObjectInput, MinioStorageConfig, StorageHealthStatus, UploadObjectInput } from './types.js';

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