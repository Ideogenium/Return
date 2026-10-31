// Force all requests to go through MSW (bypass Prism mock server)
jest.mock('../../../config/api-modules.config', () => ({
  getBaseUrl: () => 'http://localhost:3000/v1',
}));

const mockDispatch = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ dispatch: mockDispatch }),
  // Run the focus effect once on mount, like a focused screen
  useFocusEffect: (effect: () => void) => {
    const { useEffect } = require('react');
    useEffect(effect, [effect]);
  },
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../__mocks__/server';
import { NotificationListScreen } from '../NotificationListScreen';
import { useNotificationStore } from '../../../stores/useNotificationStore';

const base = { title: 't', body: 'b', isRead: true, createdAt: '2026-03-18T10:00:00Z' };
const notifications = [
  { ...base, id: 'n-recv', type: 'CONTACT_INVITATION_RECEIVED', relatedLoanId: null },
  { ...base, id: 'n-acc', type: 'CONTACT_INVITATION_ACCEPTED', relatedLoanId: null },
  { ...base, id: 'n-loan', type: 'LOAN_CREATED', relatedLoanId: 'loan-42' },
  { ...base, id: 'n-unknown', type: 'FUTURE_TYPE', relatedLoanId: null },
];

beforeAll(() => server.listen());
beforeEach(() => {
  mockDispatch.mockClear();
  server.use(
    http.get('http://localhost:3000/v1/notifications', () =>
      HttpResponse.json({
        data: notifications,
        pagination: {
          currentPage: 1,
          itemsPerPage: 20,
          totalItems: 4,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      }),
    ),
  );
});
afterEach(() => {
  server.resetHandlers();
  useNotificationStore.getState().reset();
});
afterAll(() => server.close());

async function renderAndPress(id: string) {
  render(
    <PaperProvider>
      <NotificationListScreen />
    </PaperProvider>,
  );
  await waitFor(() => expect(screen.getByTestId(`notification-card-${id}`)).toBeTruthy());
  fireEvent.press(screen.getByTestId(`notification-card-${id}`));
}

describe('NotificationListScreen navigation on tap', () => {
  it('opens the received invitations for CONTACT_INVITATION_RECEIVED', async () => {
    await renderAndPress('n-recv');

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch.mock.calls[0][0]).toMatchObject({
      type: 'NAVIGATE',
      payload: {
        name: 'Tabs',
        params: {
          screen: 'BorrowerTab',
          params: { screen: 'BorrowerInvitations', initial: false },
        },
      },
    });
  });

  it('opens the sent invitations for CONTACT_INVITATION_ACCEPTED', async () => {
    await renderAndPress('n-acc');

    expect(mockDispatch.mock.calls[0][0]).toMatchObject({
      payload: {
        name: 'Tabs',
        params: {
          screen: 'BorrowerTab',
          params: { screen: 'SentInvitations', initial: false },
        },
      },
    });
  });

  it('keeps opening the loan detail for a loan notification', async () => {
    await renderAndPress('n-loan');

    expect(mockDispatch.mock.calls[0][0]).toMatchObject({
      payload: {
        name: 'Tabs',
        params: {
          screen: 'LoanTab',
          params: { screen: 'LoanDetail', params: { id: 'loan-42' }, initial: false },
        },
      },
    });
  });

  it('does nothing for an unknown type without relatedLoanId', async () => {
    await renderAndPress('n-unknown');

    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
