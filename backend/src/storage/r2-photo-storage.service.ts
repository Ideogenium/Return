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

// Every upload gets a fresh key (items: uuid, avatars: avatar-<uuid>), so an
// object's content never changes for a given URL.
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export function createR2Client(settings: R2Settings): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
  });
}

export class R2PhotoStorageService implements PhotoStorage {
  private readonly logger = new Logger(R2PhotoStorageService.name);

  constructor(
    private readonly settings: R2Settings,
    private readonly s3: Pick<S3Client, 'send'> = createR2Client(settings),
  ) {}

  async upload(file: Buffer, key: string): Promise<PhotoUploadResult> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.settings.bucketName,
        Key: key,
        Body: file,
        ContentType: contentTypeOf(key),
        CacheControl: IMMUTABLE_CACHE_CONTROL,
      }),
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
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.settings.bucketName, Key: key }));

    this.logger.debug(`Photo deleted from R2: ${key}`);
  }

  getUrl(key: string): Promise<string> {
    return Promise.resolve(this.urlOf(key));
  }

  private urlOf(key: string): string {
    return `${this.settings.publicUrl}/${key}`;
  }

  /** Storage key for a key or a public URL of this bucket; null for any other URL. */
  private resolveKey(keyOrUrl: string): string | null {
    const bucketPrefix = `${this.settings.publicUrl}/`;
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
