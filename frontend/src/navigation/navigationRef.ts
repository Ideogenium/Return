import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootAppStackParamList } from './types';
import type { ContactInvitationNotificationType } from '../types/api.types';

export const navigationRef = createNavigationContainerRef<RootAppStackParamList>();

/**
 * `Tabs` params that open a loan's detail with the loan list under it.
 * Without `initial: false`, React Navigation makes the detail the first screen of a loan
 * stack that was not mounted yet: no back button, no way back to the list.
 */
export function loanDetailTabsParams(loanId: string): RootAppStackParamList['Tabs'] {
  return {
    screen: 'LoanTab',
    params: {
      screen: 'LoanDetail',
      params: { id: loanId },
      initial: false,
    },
  };
}

/**
 * Runtime check for push `data.type` values, which arrive untyped (`Record<string, unknown>`).
 * Narrows to the contact-invitation notification types that can be opened from a push.
 */
export function isContactInvitationPushType(
  value: unknown,
): value is ContactInvitationNotificationType {
  return value === 'CONTACT_INVITATION_RECEIVED' || value === 'CONTACT_INVITATION_ACCEPTED';
}

/**
 * `Tabs` params for the screen matching a contact-invitation notification: the invitations
 * I received (RECEIVED) or the ones I sent (ACCEPTED), with the contact list under it.
 * Returns null for any other type, so callers can ignore notifications they cannot open.
 */
export function invitationTabsParams(type: unknown): RootAppStackParamList['Tabs'] | null {
  if (!isContactInvitationPushType(type)) {
    return null;
  }
  const screen = type === 'CONTACT_INVITATION_RECEIVED' ? 'BorrowerInvitations' : 'SentInvitations';
  // `initial: false` for the same reason as loanDetailTabsParams
  return { screen: 'BorrowerTab', params: { screen, initial: false } };
}

/**
 * Deep-link to the received/sent invitations from a push-notification tap.
 * No-op for an unknown type or when the navigation tree is not mounted yet.
 */
export function navigateToInvitationsFromPush(type: unknown): void {
  const params = invitationTabsParams(type);
  if (!params || !navigationRef.isReady()) {
    return;
  }

  navigationRef.navigate('Tabs', params);
}

/**
 * Deep-link to a loan's detail screen from a push-notification tap.
 * No-op when the loanId is missing or the navigation tree is not mounted yet.
 */
export function navigateToLoanDetail(loanId: string | undefined): void {
  if (!loanId || !navigationRef.isReady()) {
    return;
  }

  navigationRef.navigate('Tabs', loanDetailTabsParams(loanId));
}
