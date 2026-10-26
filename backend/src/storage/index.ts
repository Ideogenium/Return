export { PhotoStorageModule } from './photo-storage.module.js';
export { LocalPhotoStorageService } from './local-photo-storage.service.js';
export { R2PhotoStorageService } from './r2-photo-storage.service.js';
export { createPhotoStorage } from './photo-storage.factory.js';
export { readR2Settings } from './r2-settings.js';
export type { R2Settings } from './r2-settings.js';
export type { PhotoStorage, PhotoUploadResult } from './interfaces/index.js';
export { PHOTO_STORAGE } from './interfaces/index.js';
