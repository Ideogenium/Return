import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootAppStackParamList } from './types';

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
 * Deep-link to a loan's detail screen from a push-notification tap.
 * No-op when the loanId is missing or the navigation tree is not mounted yet.
 */
export function navigateToLoanDetail(loanId: string | undefined): void {
  if (!loanId || !navigationRef.isReady()) {
    return;
  }

  navigationRef.navigate('Tabs', loanDetailTabsParams(loanId));
}
