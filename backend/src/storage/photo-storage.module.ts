import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PHOTO_STORAGE } from './interfaces/photo-storage.interface.js';
import { createPhotoStorage } from './photo-storage.factory.js';

// =============================================================================
// PhotoStorageModule
// =============================================================================
// Fournit l'injection PHOTO_STORAGE : Cloudflare R2 si les variables R2_* sont
// définies (production), stockage disque local sinon (dev / tests).
// =============================================================================

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PHOTO_STORAGE,
      useFactory: createPhotoStorage,
      inject: [ConfigService],
    },
  ],
  exports: [PHOTO_STORAGE],
})
export class PhotoStorageModule {}
