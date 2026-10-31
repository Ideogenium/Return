import { FileTypeValidator, MaxFileSizeValidator, ParseFilePipe } from '@nestjs/common';
import type { FileInterceptor } from '@nestjs/platform-express';

/** Options of FileInterceptor (Multer), not exported by name from the package root. */
type MulterOptions = NonNullable<Parameters<typeof FileInterceptor>[1]>;

// =============================================================================
// Upload limits — single source for Multer and ParseFilePipe
// =============================================================================
// Multer stops reading a file as soon as it passes `fileSize` (nothing is buffered
// beyond it); ParseFilePipe then checks the size and the real type (magic numbers)
// of what was kept. Both use the same limit, from the contract (openapi.yaml).
// =============================================================================

/** Item photo: JPEG or PNG, at most 5 MB (POST /items/{itemId}/photos). */
export const ITEM_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Profile picture: JPEG or PNG, at most 2 MB (PUT /users/me/avatar). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = /(jpeg|jpg|png)$/;

/**
 * Multer options of a single-image upload route. Besides the file size, the other
 * multipart counters are bounded too: the app sends one file part and nothing else,
 * so a request with more files, many fields or long field values is refused early.
 */
export function imageUploadOptions(maxBytes: number): MulterOptions {
  return {
    limits: {
      fileSize: maxBytes,
      files: 1,
      fields: 5,
      fieldSize: 1024,
      parts: 6,
    },
  };
}

/** Size and type checks of the kept file, with the same limit as Multer. */
export function imageFilePipe(maxBytes: number): ParseFilePipe {
  return new ParseFilePipe({
    validators: [
      new MaxFileSizeValidator({ maxSize: maxBytes }),
      new FileTypeValidator({ fileType: ALLOWED_IMAGE_TYPES }),
    ],
  });
}
