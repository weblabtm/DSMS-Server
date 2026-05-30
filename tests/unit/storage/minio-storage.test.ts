import { describe, expect, it } from 'vitest';

import { buildPublicReadBucketPolicy, createPublicObjectUrl } from '../../../src/infrastructure/storage/minio-storage.js';

describe('minio storage helpers', () => {
    it('creates a public-read bucket policy for the configured bucket', () => {
        const policy = buildPublicReadBucketPolicy('dsms-files');

        expect(policy).toContain('arn:aws:s3:::dsms-files/*');
        expect(policy).toContain('s3:GetObject');
        expect(policy).toContain('PublicReaddsms-files');
    });

    it('builds a public object url when the bucket is public', () => {
        const url = createPublicObjectUrl(
            {
                endpoint: 'localhost',
                port: 9000,
                useSSL: false,
                accessKey: 'minioadmin',
                secretKey: 'minioadmin',
                bucket: 'dsms-files',
                region: 'us-east-1',
                bucketPolicy: 'public-read',
            },
            'uploads/avatar.png',
        );

        expect(url).toBe('http://localhost:9000/dsms-files/uploads%2Favatar.png');
    });

    it('returns null for private buckets', () => {
        const url = createPublicObjectUrl(
            {
                endpoint: 'localhost',
                port: 9000,
                useSSL: false,
                accessKey: 'minioadmin',
                secretKey: 'minioadmin',
                bucket: 'dsms-files',
                region: 'us-east-1',
                bucketPolicy: 'private',
            },
            'uploads/avatar.png',
        );

        expect(url).toBeNull();
    });
});