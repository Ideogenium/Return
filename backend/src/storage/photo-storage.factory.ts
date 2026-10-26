import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { PhotoStorage } from './interfaces/photo-storage.interface.js';
import { LocalPhotoStorageService } from './local-photo-storage.service.js';
import { R2PhotoStorageService } from './r2-photo-storage.service.js';
import { readR2Settings } from '../config/r2-settings.js';

/** Picks the PhotoStorage implementation: Cloudflare R2 when configured, local disk otherwise. */
export function createPhotoStorage(config: ConfigService): PhotoStorage {
  const logger = new Logger('PhotoStorage');
  const r2Settings = readR2Settings((key) => config.get<string>(key));

  if (r2Settings) {
    logger.log(`Using Cloudflare R2 photo storage (bucket "${r2Settings.bucketName}")`);
    return new R2PhotoStorageService(r2Settings);
  }

  logger.log('Using local disk photo storage');
  return new LocalPhotoStorageService(config);
}
