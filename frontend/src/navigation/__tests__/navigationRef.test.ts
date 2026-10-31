jest.mock('@react-navigation/native', () => {
  const navigate = jest.fn();
  const isReady = jest.fn();
  return {
    __esModule: true,
    createNavigationContainerRef: () => ({ isReady, navigate }),
    __navigate: navigate,
    __isReady: isReady,
  };
});

import { navigateToLoanDetail } from '../navigationRef';
import * as ReactNavigation from '@react-navigation/native';

const mockNavigate = (ReactNavigation as unknown as { __navigate: jest.Mock }).__navigate;
const mockIsReady = (ReactNavigation as unknown as { __isReady: jest.Mock }).__isReady;

describe('navigateToLoanDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsReady.mockReturnValue(true);
  });

  it('navigates to LoanDetail when loanId is valid and navigation is ready', () => {
    navigateToLoanDetail('loan-123');

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('Tabs', {
      screen: 'LoanTab',
      params: {
        screen: 'LoanDetail',
        params: { id: 'loan-123' },
        initial: false,
      },
    });
  });

  it('does not navigate when loanId is undefined', () => {
    navigateToLoanDetail(undefined);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not navigate when loanId is an empty string', () => {
    navigateToLoanDetail('');

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not navigate when navigation is not ready', () => {
    mockIsReady.mockReturnValue(false);

    navigateToLoanDetail('loan-123');

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
