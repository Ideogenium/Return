import { Logger } from '@nestjs/common';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import type { PhotoStorage, PhotoUploadResult } from './interfaces/photo-storage.interface.js';
import type { R2Settings } from '../config/r2-settings.js';

// =============================================================================
// R2PhotoStorage — Cloudflare R2 implementation (production)
// =============================================================================
// R2 is S3-compatible. Objects are served directly from the bucket's public URL;
// the API only stores and deletes them. Built by PhotoStorageModule's factory.
// =============================================================================

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

// Every upload gets a fresh key (avatar-<uuid>, <uuid>), so a URL's content never
// changes: clients may cache it forever. CDN edges keep it one day only, so a
// deleted photo stops being served without an explicit cache purge.
const CACHE_CONTROL = 'public, max-age=31536000, s-maxage=86400, immutable';

/** Where photos live; deliberately carries no credential. */
export type R2BucketTarget = Pick<R2Settings, 'bucketName' | 'publicUrl'>;

export function createR2Client(settings: R2Settings): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
    maxAttempts: 3,
    requestHandler: {
      connectionTimeout: 3_000,
      requestTimeout: 15_000,
      throwOnRequestTimeout: true,
    },
    // SDK default (WHEN_SUPPORTED) adds checksum headers R2 does not fully support.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

export class R2PhotoStorageService implements PhotoStorage {
  private readonly logger = new Logger(R2PhotoStorageService.name);

  constructor(
    private readonly bucket: R2BucketTarget,
    private readonly s3: Pick<S3Client, 'send'>,
  ) {}

  async upload(file: Buffer, key: string): Promise<PhotoUploadResult> {
    await this.logFailure('upload', key, () =>
      this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket.bucketName,
          Key: key,
          Body: file,
          ContentType: contentTypeOf(key),
          CacheControl: CACHE_CONTROL,
        }),
      ),
    );

    this.logger.debug(`Photo uploaded to R2: ${key}`);

    return { key, url: this.urlOf(key), thumbnailUrl: null };
  }

  async delete(keyOrUrl: string): Promise<void> {
    const key = this.resolveKey(keyOrUrl);
    if (key === null) {
      this.logger.warn(`Photo URL is not in the R2 bucket, nothing to delete: ${keyOrUrl}`);
      return;
    }

    // S3 DeleteObject succeeds on a missing key: idempotent as required by PhotoStorage.
    await this.logFailure('delete', key, () =>
      this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket.bucketName, Key: key })),
    );

    this.logger.debug(`Photo deleted from R2: ${key}`);
  }

  /** Logs the failed operation with its key (never credentials), then rethrows. */
  private async logFailure(
    operation: 'upload' | 'delete',
    key: string,
    run: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await run();
    } catch (error) {
      this.logger.error(`R2 ${operation} failed for ${key}: ${(error as Error).name}`);
      throw error;
    }
  }

  getUrl(key: string): Promise<string> {
    return Promise.resolve(this.urlOf(key));
  }

  private urlOf(key: string): string {
    return `${this.bucket.publicUrl}/${key}`;
  }

  /** Storage key for a key or a public URL of this bucket; null for any other URL. */
  private resolveKey(keyOrUrl: string): string | null {
    const bucketPrefix = `${this.bucket.publicUrl}/`;
    if (keyOrUrl.startsWith(bucketPrefix)) {
      return keyOrUrl.slice(bucketPrefix.length);
    }
    return /^https?:\/\//i.test(keyOrUrl) ? null : keyOrUrl;
  }
}

function contentTypeOf(key: string): string {
  const extension = key.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}
