import { Linking } from 'react-native';
import { getBaseUrl } from '../config/api-modules.config';

const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
const DEFAULT_LANGUAGE = 'fr';

/**
 * Public privacy policy page served by the API at the root (outside the /v1 prefix).
 * `language` is the i18n language, possibly regional (fr-FR); unknown values fall back to fr.
 */
export function getPrivacyPolicyUrl(language?: string): string {
  const apiRoot = getBaseUrl('/privacy').replace(/\/+$/, '').replace(/\/v1$/, '');
  const base = language?.split('-')[0]?.toLowerCase();
  const lang = SUPPORTED_LANGUAGES.find((supported) => supported === base) ?? DEFAULT_LANGUAGE;
  return `${apiRoot}/privacy?lang=${lang}`;
}

/** Opens the policy in the system browser; a failure (no browser, bad URL) must never crash the UI. */
export async function openPrivacyPolicy(language?: string): Promise<void> {
  try {
    await Linking.openURL(getPrivacyPolicyUrl(language));
  } catch {
    // Nothing actionable for the user; the policy stays reachable from the store listing.
  }
}
