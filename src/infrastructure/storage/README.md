# Storage Infrastructure

This folder contains the MinIO-backed object storage layer used for file upload, file download, and bucket initialization.

## What it does

- Builds MinIO config from environment variables.
- Creates the MinIO client.
- Ensures the bucket exists at startup.
- Supports uploads, downloads, public object URLs, and presigned URLs.

## Main entry points

- `MinioStorageService` from `minio-storage.ts`
- The split implementation under `minio/`

## Folder layout

- `minio-storage.ts` - compatibility export for the storage module
- `minio/types.ts` - shared config and request/response types
- `minio/config.ts` - environment-to-storage config mapping
- `minio/client.ts` - MinIO client creation and config checks
- `minio/bucket.ts` - bucket initialization and policy setup
- `minio/objects.ts` - upload and download operations
- `minio/urls.ts` - public and presigned URL helpers
- `minio/service.ts` - application-facing service wrapper
- `minio/index.ts` - barrel export for the storage module

## How application code uses it

Create the service once from `EnvironmentConfig`, then call the helper you need.

Example:

```ts
import { EnvironmentConfig } from '../../config/environment.js';
import { MinioStorageService } from '../infrastructure/storage/minio-storage.js';

const environment = EnvironmentConfig.fromProcessEnv();
const storage = new MinioStorageService(environment);

await storage.connect();

await storage.uploadObject({
  objectName: 'uploads/avatar.png',
  data: fileBuffer,
  contentType: 'image/png',
});

const fileBuffer = await storage.downloadObjectBuffer({
  objectName: 'uploads/avatar.png',
});

const signedDownloadUrl = await storage.createDownloadUrl('uploads/avatar.png');
```

If the bucket policy is `public-read`, `getPublicObjectUrl()` returns a direct URL. Otherwise, use `createDownloadUrl()` for private access.

## When to use it

Use this infrastructure when you need:

- avatar or attachment uploads
- generated files or exports
- document/object storage outside the database
- signed download links or direct public object URLs

## Environment variables

- `MINIO_ENDPOINT`
- `MINIO_PORT`
- `MINIO_USE_SSL`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_BUCKET`
- `MINIO_REGION`
- `MINIO_BUCKET_POLICY`

## Notes for the team

- Keep storage logic in services, not controllers.
- Use `uploadObject()` for server-side uploads.
- Use `createUploadUrl()` when the client should upload directly to MinIO.
- Use `createDownloadUrl()` when the client should fetch a private object securely.
- The local-dev pipeline creates the bucket automatically from `.env`.
