import { Platform } from 'react-native';
import { File as DeviceFile } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Longest side of an uploaded photo, in pixels: sharp on a phone screen, well under the API size limits. */
export const MAX_PHOTO_DIMENSION = 2048;

/** Longest side of an avatar, in pixels: it is only shown small, and stays far below the 2 MB avatar limit. */
export const AVATAR_MAX_DIMENSION = 1024;

/** JPEG quality of the converted photo (0 to 1). */
export const PHOTO_JPEG_QUALITY = 0.8;

/** MIME type of a photo from its URI extension: PNG, otherwise JPEG. */
export function getMimeType(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  return 'image/jpeg';
}

/**
 * Resize that brings the longest side down to `maxDimension`, keeping the ratio.
 * Returns null when the photo already fits (a photo is never enlarged) or its size is unknown.
 */
export function photoResize(
  width: number | undefined,
  height: number | undefined,
  maxDimension: number,
): { width: number } | { height: number } | null {
  if (!width || !height || Math.max(width, height) <= maxDimension) return null;
  return width >= height ? { width: maxDimension } : { height: maxDimension };
}

/** Upload limit of an item photo (API: 5 MB). */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Upload limit of an avatar (API: 2 MB). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export interface PhotoConversionOptions {
  /** Longest side of the result, in pixels. */
  maxDimension?: number;
  /** Upload limit of the target, in bytes: a PNG over it is sent as JPEG instead. */
  maxBytes?: number;
}

/**
 * Re-encodes a picked photo on the device, before any upload.
 *
 * - Any format the phone can decode is accepted: iPhone photos are HEIC by default, some
 *   Android galleries hold HEIF or WebP. They become JPEG: the API (and the contract) only
 *   takes JPEG or PNG.
 * - A PNG stays a PNG, so a transparent background (an iPhone subject cut-out, a logo) does
 *   not turn black. PNG is lossless and can stay heavy: when the result is over `maxBytes`,
 *   or its size cannot be read, the photo is sent as JPEG instead.
 * - The photo is scaled down to `maxDimension` on its longest side, which keeps a JPEG under
 *   the API size limits whatever the original weighs.
 * - Re-encoding drops the metadata, including the GPS position where the photo was taken.
 *
 * @returns the URI of the converted file (.jpg or .png), in the app cache.
 */
export async function convertPhotoForUpload(
  asset: { uri: string; mimeType?: string; width?: number; height?: number },
  { maxDimension = MAX_PHOTO_DIMENSION, maxBytes = MAX_PHOTO_BYTES }: PhotoConversionOptions = {},
): Promise<string> {
  const isPng = (asset.mimeType ?? getMimeType(asset.uri)) === 'image/png';
  const context = ImageManipulator.manipulate(asset.uri);
  try {
    const resize = photoResize(asset.width, asset.height, maxDimension);
    if (resize) context.resize(resize);
    const image = await context.renderAsync();
    try {
      if (isPng) {
        const png = await image.saveAsync({ format: SaveFormat.PNG });
        const pngFile = new DeviceFile(png.uri);
        // size is 0 when the file cannot be read: the JPEG fallback is the safe choice.
        const size = pngFile.size;
        if (size > 0 && size <= maxBytes) return png.uri;
        pngFile.delete();
      }
      const jpeg = await image.saveAsync({ format: SaveFormat.JPEG, compress: PHOTO_JPEG_QUALITY });
      return jpeg.uri;
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}

/**
 * Build a FormData ready for photo upload.
 * On web, converts the URI (data-url or blob-url) into a real File so Multer
 * can parse the multipart body. On native, uses the RN { uri, type, name } convention.
 */
export async function buildPhotoFormData(uri: string, fieldName = 'photo'): Promise<FormData> {
  const mimeType = getMimeType(uri);
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const fileName = `photo.${ext}`;

  const formData = new FormData();

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    const file = new File([blob], fileName, { type: mimeType });
    formData.append(fieldName, file);
  } else {
    formData.append(fieldName, {
      uri,
      type: mimeType,
      name: fileName,
    } as unknown as Blob);
  }

  return formData;
}
