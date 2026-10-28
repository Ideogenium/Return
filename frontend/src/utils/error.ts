import type { AxiosError } from 'axios';
import type { TFunction } from 'i18next';
import type { ProblemDetails } from '../types/api.types';
import { PASSWORD_SPECIAL_CHARACTERS } from './password';

// Extrait un ProblemDetails depuis une erreur Axios (retourne null si non-RFC 7807)
export function parseProblemDetails(error: AxiosError): ProblemDetails | null {
  const data = error.response?.data;
  if (data && typeof data === 'object' && 'type' in data) {
    return data as ProblemDetails;
  }
  return null;
}

// Extrait un ProblemDetails depuis une erreur inconnue (fabrique un fallback réseau si non-RFC 7807)
export function extractProblemDetails(err: unknown): ProblemDetails {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: unknown } }).response;
    if (response?.data && typeof response.data === 'object' && 'type' in response.data) {
      return response.data as ProblemDetails;
    }
  }
  return {
    type: 'https://api.return.app/errors/network-error',
    title: 'Network Error',
    status: 0,
    detail: 'Unable to reach the server. Check your connection.',
    instance: '',
    timestamp: new Date().toISOString(),
    requestId: '',
  };
}

// Table de correspondance type d'erreur → clé i18n
const ERROR_TYPE_MAP: Record<string, string> = {
  'https://api.return.app/errors/invalid-credentials': 'errors.invalidCredentials',
  'https://api.return.app/errors/email-already-exists': 'errors.emailAlreadyExists',
  'https://api.return.app/errors/active-loans-exist': 'errors.activeLoansExist',
  'https://api.return.app/errors/borrower-already-exists': 'errors.borrowerAlreadyExists',
  'https://api.return.app/errors/borrower-not-found': 'errors.borrowerNotFound',
  'https://api.return.app/errors/invalid-current-password': 'errors.invalidCurrentPassword',
  'https://api.return.app/errors/validation-failed': 'errors.validationFailed',
  'https://api.return.app/errors/network-error': 'errors.networkError',
  'https://api.return.app/errors/item-not-found': 'errors.itemNotFound',
  'https://api.return.app/errors/item-currently-loaned': 'errors.itemCurrentlyLoaned',
  'https://api.return.app/errors/item-already-loaned': 'errors.itemAlreadyLoaned',
  'https://api.return.app/errors/max-photos-exceeded': 'errors.maxPhotosExceeded',
  'https://api.return.app/errors/photo-not-found': 'errors.photoNotFound',
  'https://api.return.app/errors/estimated-value-required': 'items.estimatedValueRequired',
  'https://api.return.app/errors/unauthorized': 'errors.unauthorized',
  'https://api.return.app/errors/invalid-token': 'errors.unauthorized',
  'https://api.return.app/errors/forbidden': 'errors.forbidden',
  'https://api.return.app/errors/rate-limit-exceeded': 'errors.rateLimitExceeded',
  'https://api.return.app/errors/internal-server-error': 'errors.internalServerError',
  'https://api.return.app/errors/loan-not-found': 'errors.loanNotFound',
  'https://api.return.app/errors/daily-loan-limit-exceeded': 'errors.dailyLoanLimitExceeded',
  'https://api.return.app/errors/loan-already-returned': 'errors.loanAlreadyReturned',
  'https://api.return.app/errors/loan-return-date-locked': 'errors.loanReturnDateLocked',
  'https://api.return.app/errors/forbidden-status-transition': 'errors.forbiddenStatusTransition',
  'https://api.return.app/errors/invalid-status-transition': 'errors.invalidStatusTransition',
  'https://api.return.app/errors/invalid-return-date': 'errors.invalidReturnDate',
  'https://api.return.app/errors/self-invitation': 'errors.selfInvitation',
  'https://api.return.app/errors/user-not-found': 'errors.userNotFound',
  'https://api.return.app/errors/invitation-already-sent': 'errors.invitationAlreadySent',
  'https://api.return.app/errors/invitation-not-found': 'errors.invitationNotFound',
  'https://api.return.app/errors/invitation-not-pending': 'errors.invitationNotPending',
  'https://api.return.app/errors/invitation-already-accepted': 'errors.invitationAlreadyAccepted',
  'https://api.return.app/errors/contact-not-accepted': 'errors.contactNotAccepted',
  'https://api.return.app/errors/return-date-too-soon': 'loans.returnDateTooSoon',
  'https://api.return.app/errors/device-token-not-found': 'errors.deviceTokenNotFound',
};

// Traduit un ProblemDetails en message lisible
export function getErrorMessage(error: ProblemDetails, t: TFunction): string {
  const i18nKey = ERROR_TYPE_MAP[error.type];
  if (i18nKey) {
    return t(i18nKey);
  }
  return error.detail || t('errors.unknownError');
}

/** i18n key per (field, API error code) — codes come from the API ValidationPipe (main.ts). */
const PASSWORD_FIELD_KEYS: Record<string, string> = {
  INVALID_FORMAT: 'auth.passwordRules',
  TOO_SHORT: 'auth.passwordMinLength',
  TOO_LONG: 'auth.passwordMaxLength',
  REQUIRED: 'auth.passwordRequired',
  INVALID_TYPE: 'auth.passwordRequired',
};

const FIELD_ERROR_KEYS: Record<string, Record<string, string>> = {
  password: PASSWORD_FIELD_KEYS,
  newPassword: PASSWORD_FIELD_KEYS,
  currentPassword: { REQUIRED: 'auth.passwordRequired', INVALID_TYPE: 'auth.passwordRequired' },
  email: {
    INVALID_EMAIL: 'auth.emailInvalid',
    REQUIRED: 'auth.emailRequired',
    INVALID_TYPE: 'auth.emailRequired',
  },
  firstName: {
    TOO_LONG: 'auth.nameMaxLength',
    TOO_SHORT: 'auth.firstNameRequired',
    REQUIRED: 'auth.firstNameRequired',
    INVALID_TYPE: 'auth.firstNameRequired',
  },
  lastName: {
    TOO_LONG: 'auth.nameMaxLength',
    TOO_SHORT: 'auth.lastNameRequired',
    REQUIRED: 'auth.lastNameRequired',
    INVALID_TYPE: 'auth.lastNameRequired',
  },
};

/**
 * Field-level messages for an API `validation-failed` problem, so a form can show
 * each error under its own field instead of a generic banner. Empty for any other problem.
 *
 * @param fields the fields the form displays: errors on other fields are left out, so the
 *               caller can fall back to its banner when nothing can be shown under a field.
 */
export function getFieldErrors(
  error: ProblemDetails,
  t: TFunction,
  fields?: readonly string[],
): Record<string, string> {
  if (!error.type.endsWith('/validation-failed') || !error.errors) return {};
  const messages: Record<string, string> = {};
  for (const { field, code } of error.errors) {
    if (field in messages || (fields && !fields.includes(field))) continue;
    messages[field] = t(FIELD_ERROR_KEYS[field]?.[code] ?? 'errors.fieldInvalid', {
      allowed: PASSWORD_SPECIAL_CHARACTERS,
    });
  }
  return messages;
}
