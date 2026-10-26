// =============================================================================
// R2 settings — single source of truth for the photo storage driver choice
// =============================================================================
// All R2_* variables set → Cloudflare R2. None set → local disk (dev/tests).
// A partial configuration is always an error: it would otherwise fall back to
// the local disk and lose photos silently on an ephemeral host.
// =============================================================================

export interface R2Settings {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  /** Public base URL of the bucket, https, without trailing slash */
  publicUrl: string;
}

const R2_ENV_KEYS = {
  accountId: 'R2_ACCOUNT_ID',
  accessKeyId: 'R2_ACCESS_KEY_ID',
  secretAccessKey: 'R2_SECRET_ACCESS_KEY',
  bucketName: 'R2_BUCKET_NAME',
  publicUrl: 'R2_PUBLIC_URL',
} as const satisfies Record<keyof R2Settings, string>;

export type EnvReader = (key: string) => string | undefined;

/**
 * Reads the R2 configuration.
 *
 * @returns the settings, or `null` when no R2 variable is set
 * @throws Error when the configuration is partial or `R2_PUBLIC_URL` is not an https URL
 *         (the message names the variables, never their values)
 */
export function readR2Settings(read: EnvReader): R2Settings | null {
  const value = (field: keyof R2Settings): string => read(R2_ENV_KEYS[field])?.trim() ?? '';
  const fields = Object.keys(R2_ENV_KEYS) as (keyof R2Settings)[];

  const missing = fields.filter((field) => value(field) === '');
  if (missing.length === fields.length) {
    return null;
  }
  if (missing.length > 0) {
    throw new Error(
      `Incomplete Cloudflare R2 configuration: missing ${missing.map((f) => R2_ENV_KEYS[f]).join(', ')}. ` +
        'Set every R2_* variable to use R2, or none to use local storage.',
    );
  }

  return {
    accountId: value('accountId'),
    accessKeyId: value('accessKeyId'),
    secretAccessKey: value('secretAccessKey'),
    bucketName: value('bucketName'),
    publicUrl: normalizePublicUrl(value('publicUrl')),
  };
}

function normalizePublicUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('R2_PUBLIC_URL must be an absolute https URL.');
  }
  if (url.protocol !== 'https:') {
    throw new Error('R2_PUBLIC_URL must be an absolute https URL.');
  }
  return raw.replace(/\/+$/, '');
}
