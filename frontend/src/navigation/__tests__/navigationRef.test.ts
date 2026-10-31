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

import {
  navigateToLoanDetail,
  navigateToInvitationsFromPush,
  isContactInvitationPushType,
} from '../navigationRef';
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

describe('navigateToInvitationsFromPush', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsReady.mockReturnValue(true);
  });

  it('opens the received invitations for CONTACT_INVITATION_RECEIVED', () => {
    navigateToInvitationsFromPush('CONTACT_INVITATION_RECEIVED');

    expect(mockNavigate).toHaveBeenCalledWith('Tabs', {
      screen: 'BorrowerTab',
      params: { screen: 'BorrowerInvitations', initial: false },
    });
  });

  it('opens the sent invitations for CONTACT_INVITATION_ACCEPTED', () => {
    navigateToInvitationsFromPush('CONTACT_INVITATION_ACCEPTED');

    expect(mockNavigate).toHaveBeenCalledWith('Tabs', {
      screen: 'BorrowerTab',
      params: { screen: 'SentInvitations', initial: false },
    });
  });

  it('ignores unknown or missing types', () => {
    navigateToInvitationsFromPush('SOMETHING_ELSE');
    navigateToInvitationsFromPush(undefined);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does nothing when navigation is not ready', () => {
    mockIsReady.mockReturnValue(false);

    navigateToInvitationsFromPush('CONTACT_INVITATION_RECEIVED');

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('isContactInvitationPushType', () => {
  it.each(['CONTACT_INVITATION_RECEIVED', 'CONTACT_INVITATION_ACCEPTED'])('accepts %s', (value) => {
    expect(isContactInvitationPushType(value)).toBe(true);
  });

  it.each([
    ['an unknown type', 'LOAN_CREATED'],
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['an object', { type: 'CONTACT_INVITATION_RECEIVED' }],
  ])('rejects %s', (_label, value) => {
    expect(isContactInvitationPushType(value)).toBe(false);
  });
});
