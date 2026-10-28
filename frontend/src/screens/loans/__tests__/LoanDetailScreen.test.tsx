import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { MD3LightTheme, PaperProvider, Dialog } from 'react-native-paper';
import { server } from '../../../../__mocks__/server';
import { http, HttpResponse } from 'msw';
import { Text } from 'react-native';
import { LoanDetailScreen } from '../LoanDetailScreen';
import { LoanListScreen } from '../LoanListScreen';
import apiClient from '../../../api/apiClient';
import { useLoanStore } from '../../../stores/useLoanStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useReminderStore } from '../../../stores/useReminderStore';
import { useHistoryStore } from '../../../stores/useHistoryStore';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { LoanStackParamList } from '../../../navigation/types';

jest.mock('react-native-paper-dates', () => {
  const React = require('react');
  const { Pressable } = require('react-native');
  return {
    Calendar: ({ onChange }: { onChange: (params: { date: Date }) => void }) =>
      React.createElement(Pressable, {
        testID: 'mock-calendar-select',
        onPress: () => onChange({ date: new Date('2026-12-31T12:00:00Z') }),
      }),
  };
});

const Stack = createNativeStackNavigator<LoanStackParamList>();

function DummyCreateLoan() {
  return <Text>CreateLoanScreen</Text>;
}

function DummyConfirmLoan() {
  return <Text>ConfirmLoanScreen</Text>;
}

// Paper scales every animation duration by theme.animation.scale: 0 opens dialogs
// instantly, keeping these tests fast on a loaded machine.
const instantTheme = { ...MD3LightTheme, animation: { ...MD3LightTheme.animation, scale: 0 } };

function renderDetailScreen(loanId = '7f3c9a2b-4d1e-4a8f-9c7b-1e3f5a6b8c9d') {
  return render(
    <PaperProvider theme={instantTheme}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="LoanDetail"
            component={LoanDetailScreen}
            initialParams={{ id: loanId }}
          />
          <Stack.Screen name="LoanList" component={LoanListScreen} />
          <Stack.Screen name="CreateLoan" component={DummyCreateLoan} />
          <Stack.Screen name="ConfirmLoan" component={DummyConfirmLoan} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>,
  );
}

beforeAll(() => server.listen());
beforeEach(() => {
  // Set authenticated user matching mockLoan.lender.id
  useAuthStore.setState({
    user: {
      id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'LENDER' as const,
      profilePicture: null,
      createdAt: '2026-02-01T10:00:00Z',
      lastLoginAt: '2026-02-18T08:00:00Z',
    },
  });
});
afterEach(() => {
  server.resetHandlers();
  useLoanStore.getState().reset();
  useReminderStore.getState().reset();
  useHistoryStore.getState().reset();
  useAuthStore.setState({ user: null, accessToken: null });
});
afterAll(() => server.close());

describe('LoanDetailScreen', () => {
  it('should render loan details', async () => {
    renderDetailScreen();

    await waitFor(() => {
      expect(screen.getByTestId('loan-detail')).toBeTruthy();
    });

    expect(screen.getByText('Perceuse Bosch')).toBeTruthy();
    expect(screen.getByText(/Marie Dupont/)).toBeTruthy();
  });

  it('should show action buttons for ACTIVE loan', async () => {
    renderDetailScreen();

    await waitFor(() => {
      expect(screen.getByTestId('loan-detail')).toBeTruthy();
    });

    expect(screen.getByTestId('return-loan-btn')).toBeTruthy();
    expect(screen.getByTestId('edit-loan-btn')).toBeTruthy();
    expect(screen.getByTestId('abandon-loan-btn')).toBeTruthy();
    expect(screen.getByTestId('delete-loan-btn')).toBeTruthy();
  });

  it('should hide action buttons for RETURNED loan', async () => {
    server.use(
      http.get('http://localhost:3000/v1/loans/:id', ({ params }) => {
        return HttpResponse.json(
          {
            id: params.id,
            item: {
              id: '9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
              name: 'Perceuse Bosch',
              category: 'TOOLS',
              createdAt: '2026-02-10T10:00:00Z',
            },
            lender: {
              id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
              firstName: 'John',
              lastName: 'Doe',
              profilePicture: null,
            },
            borrower: {
              id: '5d6e7f8a-1b2c-4d3e-a5f6-7a8b9c0d1e2f',
              firstName: 'Marie',
              lastName: 'Dupont',
              email: 'marie@example.com',
            },
            status: 'RETURNED',
            returnDate: '2026-04-15',
            confirmationDate: '2026-02-02T10:00:00Z',
            returnedDate: '2026-04-10T10:00:00Z',
            notes: null,
            contestReason: null,
            createdAt: '2026-02-01T10:00:00Z',
            updatedAt: '2026-04-10T10:00:00Z',
          },
          { status: 200 },
        );
      }),
    );

    renderDetailScreen();

    await waitFor(() => {
      expect(screen.getByTestId('loan-detail')).toBeTruthy();
    });

    expect(screen.queryByTestId('return-loan-btn')).toBeNull();
    expect(screen.queryByTestId('abandon-loan-btn')).toBeNull();
    expect(screen.queryByTestId('delete-loan-btn')).toBeNull();
  });

  it('should show delete confirmation dialog', async () => {
    renderDetailScreen();

    await waitFor(() => {
      expect(screen.getByTestId('delete-loan-btn')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('delete-loan-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-dialog')).toBeTruthy();
      expect(screen.getByTestId('confirm-delete-btn')).toBeTruthy();
      expect(screen.getByTestId('cancel-delete-btn')).toBeTruthy();
    });
  });

  it('should show abandon confirmation dialog', async () => {
    renderDetailScreen();

    await waitFor(() => {
      expect(screen.getByTestId('abandon-loan-btn')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('abandon-loan-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-abandon-dialog')).toBeTruthy();
      expect(screen.getByTestId('confirm-abandon-btn')).toBeTruthy();
    });
  });

  it('should show confirm button and hide lender actions for borrower', async () => {
    // Override loan to PENDING_CONFIRMATION status
    server.use(
      http.get('http://localhost:3000/v1/loans/:id', ({ params }) => {
        return HttpResponse.json(
          {
            id: params.id,
            item: {
              id: '9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
              name: 'Perceuse Bosch',
              category: 'TOOLS',
              createdAt: '2026-02-10T10:00:00Z',
            },
            lender: {
              id: 'other-user-id',
              firstName: 'Alice',
              lastName: 'Martin',
              profilePicture: null,
            },
            borrower: {
              id: '5d6e7f8a-1b2c-4d3e-a5f6-7a8b9c0d1e2f',
              firstName: 'John',
              lastName: 'Doe',
              email: 'test@example.com',
            },
            status: 'PENDING_CONFIRMATION',
            returnDate: '2026-04-15',
            confirmationDate: null,
            returnedDate: null,
            notes: null,
            contestReason: null,
            createdAt: '2026-02-01T10:00:00Z',
            updatedAt: '2026-02-01T10:00:00Z',
          },
          { status: 200 },
        );
      }),
    );

    renderDetailScreen();

    await waitFor(() => {
      expect(screen.getByTestId('loan-detail')).toBeTruthy();
    });

    // Borrower should see confirm button
    expect(screen.getByTestId('confirm-loan-btn')).toBeTruthy();

    // Lender-only actions should be hidden
    expect(screen.queryByTestId('return-loan-btn')).toBeNull();
    expect(screen.queryByTestId('edit-loan-btn')).toBeNull();
    expect(screen.queryByTestId('abandon-loan-btn')).toBeNull();
    expect(screen.queryByTestId('delete-loan-btn')).toBeNull();
  });

  it('should delete and go back on confirm', async () => {
    renderDetailScreen();

    await waitFor(() => {
      expect(screen.getByTestId('delete-loan-btn')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('delete-loan-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-btn')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('confirm-delete-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('loan-detail')).toBeNull();
    });
  });

  it('should remove the deleted loan from the history list', async () => {
    await useHistoryStore.getState().fetchArchivedLoans();
    const archivedId = useHistoryStore.getState().loans[0]!.id;
    renderDetailScreen(archivedId);

    await waitFor(() => expect(screen.getByTestId('delete-loan-btn')).toBeTruthy());
    fireEvent.press(screen.getByTestId('delete-loan-btn'));
    await waitFor(() => expect(screen.getByTestId('confirm-delete-btn')).toBeTruthy());
    fireEvent.press(screen.getByTestId('confirm-delete-btn'));

    await waitFor(() => {
      expect(useHistoryStore.getState().loans.map((loan) => loan.id)).not.toContain(archivedId);
    });
  });

  it('should keep the history list when the deletion fails', async () => {
    await useHistoryStore.getState().fetchArchivedLoans();
    const archivedId = useHistoryStore.getState().loans[0]!.id;
    server.use(
      http.delete('http://localhost:3000/v1/loans/:id', () =>
        HttpResponse.json({ status: 500, title: 'Boom' }, { status: 500 }),
      ),
    );
    renderDetailScreen(archivedId);

    await waitFor(() => expect(screen.getByTestId('delete-loan-btn')).toBeTruthy());
    fireEvent.press(screen.getByTestId('delete-loan-btn'));
    await waitFor(() => expect(screen.getByTestId('confirm-delete-btn')).toBeTruthy());
    fireEvent.press(screen.getByTestId('confirm-delete-btn'));

    await waitFor(() => expect(screen.getByTestId('api-error')).toBeTruthy());
    expect(useHistoryStore.getState().loans.map((loan) => loan.id)).toContain(archivedId);
  });

  describe('reminders in timeline', () => {
    const REMINDERS_URL = 'http://localhost:3000/v1/loans/:id/reminders';

    it('should show sent and scheduled reminders to the lender', async () => {
      renderDetailScreen();

      await waitFor(() => {
        expect(screen.getByText('Reminder before due date')).toBeTruthy();
      });
      expect(screen.getByText('Reminder on due date')).toBeTruthy();
    });

    it('should not call the reminders endpoint for the borrower', async () => {
      const getSpy = jest.spyOn(apiClient, 'get');
      server.use(
        http.get('http://localhost:3000/v1/loans/:id', ({ params }) =>
          HttpResponse.json(
            {
              id: params.id,
              item: {
                id: '9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
                name: 'Perceuse Bosch',
                category: 'TOOLS',
                createdAt: '2026-02-10T10:00:00Z',
              },
              lender: { id: 'other-user-id', firstName: 'Alice', lastName: 'Martin' },
              borrower: { id: 'b-1', firstName: 'John', lastName: 'Doe' },
              status: 'ACTIVE',
              returnDate: '2026-04-15',
              confirmationDate: '2026-02-02T10:00:00Z',
              returnedDate: null,
              notes: null,
              contestReason: null,
              createdAt: '2026-02-01T10:00:00Z',
              updatedAt: '2026-02-02T10:00:00Z',
            },
            { status: 200 },
          ),
        ),
        http.get(REMINDERS_URL, () => HttpResponse.json([], { status: 200 })),
      );

      renderDetailScreen();

      await waitFor(() => {
        expect(screen.getByTestId('loan-timeline')).toBeTruthy();
      });
      // The reminders effect runs once the loan is loaded: let it settle before asserting
      await act(async () => {});
      const requestedUrls = getSpy.mock.calls.map(([url]) => url);
      expect(requestedUrls).toContain('/loans/7f3c9a2b-4d1e-4a8f-9c7b-1e3f5a6b8c9d');
      expect(requestedUrls.some((url) => String(url).includes('/reminders'))).toBe(false);
      expect(screen.queryByText(/reminder/i)).toBeNull();
      getSpy.mockRestore();
    });

    it('should still render the timeline when the reminders request fails', async () => {
      const getSpy = jest.spyOn(apiClient, 'get');
      server.use(http.get(REMINDERS_URL, () => HttpResponse.error()));

      renderDetailScreen();

      await waitFor(() => {
        expect(getSpy.mock.calls.some(([url]) => String(url).includes('/reminders'))).toBe(true);
      });
      // Wait for the failed request to actually settle before checking the outcome
      const remindersCallIndex = getSpy.mock.calls.findIndex(([url]) =>
        String(url).includes('/reminders'),
      );
      await getSpy.mock.results[remindersCallIndex]!.value.catch(() => {});
      await act(async () => {});

      expect(screen.getByTestId('loan-timeline')).toBeTruthy();
      expect(useReminderStore.getState().reminders).toEqual([]);
      expect(screen.queryByText(/reminder/i)).toBeNull();
      expect(screen.queryByTestId('api-error')).toBeNull();
      getSpy.mockRestore();
    });
  });
});

describe('LoanDetailScreen — return date lock (409 loan-return-date-locked)', () => {
  let servedStatus = 'ACTIVE';

  const loanFixture = (id: string, status: string) => ({
    id,
    item: {
      id: '9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
      name: 'Perceuse Bosch',
      category: 'TOOLS',
      createdAt: '2026-02-10T10:00:00Z',
    },
    lender: {
      id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      firstName: 'John',
      lastName: 'Doe',
      profilePicture: null,
    },
    borrower: {
      id: '5d6e7f8a-1b2c-4d3e-a5f6-7a8b9c0d1e2f',
      firstName: 'Marie',
      lastName: 'Dupont',
      email: 'marie@example.com',
    },
    status,
    returnDate: '2026-04-15',
    confirmationDate: '2026-02-02T10:00:00Z',
    returnedDate: null,
    notes: 'old notes',
    contestReason: null,
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-02-02T10:00:00Z',
  });

  function serveLoanWithStatus(status: string) {
    servedStatus = status;
    server.use(
      http.get('http://localhost:3000/v1/loans/:id', ({ params }) =>
        HttpResponse.json(loanFixture(String(params.id), status), { status: 200 }),
      ),
    );
  }

  function capturePatchBody(): { body?: Record<string, unknown> } {
    const captured: { body?: Record<string, unknown> } = {};
    server.use(
      http.patch('http://localhost:3000/v1/loans/:id', async ({ params, request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { ...loanFixture(String(params.id), servedStatus), ...captured.body },
          { status: 200 },
        );
      }),
    );
    return captured;
  }

  const editDialog = () =>
    screen.UNSAFE_getAllByType(Dialog).find((d) => d.props.testID === 'edit-loan-dialog');

  async function openEditDialog() {
    renderDetailScreen();
    await waitFor(() => {
      expect(screen.getByTestId('edit-loan-btn')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('edit-loan-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('edit-loan-dialog')).toBeTruthy();
    });
  }

  it('lets the lender change the return date of an open loan', async () => {
    serveLoanWithStatus('ACTIVE');

    await openEditDialog();

    expect(screen.getByTestId('edit-return-date-input')).toBeTruthy();
    expect(screen.queryByTestId('return-date-locked-hint')).toBeNull();
  });

  it('hides the return date and explains why for an overdue loan', async () => {
    serveLoanWithStatus('AWAITING_RETURN');

    await openEditDialog();

    expect(screen.queryByTestId('edit-return-date-input')).toBeNull();
    expect(screen.getByTestId('return-date-locked-hint')).toBeTruthy();
  });

  it('saves only the notes of an overdue loan, without sending a return date', async () => {
    serveLoanWithStatus('AWAITING_RETURN');
    const captured = capturePatchBody();

    await openEditDialog();
    fireEvent.changeText(screen.getByTestId('edit-notes-input'), 'new notes');
    fireEvent.press(screen.getByTestId('confirm-edit-btn'));

    await waitFor(() => {
      expect(captured.body).toBeDefined();
    });
    expect(captured.body).toEqual({ notes: 'new notes' });
  });

  it('does not send an unchanged return date when only the notes of an open loan change', async () => {
    serveLoanWithStatus('ACTIVE');
    const captured = capturePatchBody();

    await openEditDialog();
    fireEvent.changeText(screen.getByTestId('edit-notes-input'), 'new notes');
    fireEvent.press(screen.getByTestId('confirm-edit-btn'));

    await waitFor(() => {
      expect(captured.body).toBeDefined();
    });
    expect(captured.body).not.toHaveProperty('returnDate');
  });

  it('keeps the edit open, preserves the notes and refreshes the loan when the date is refused with 409', async () => {
    serveLoanWithStatus('ACTIVE');
    server.use(
      http.patch('http://localhost:3000/v1/loans/:id', ({ params }) => {
        // The loan turned overdue while the lender was editing it.
        serveLoanWithStatus('AWAITING_RETURN');
        return HttpResponse.json(
          {
            type: 'https://api.return.app/errors/loan-return-date-locked',
            title: 'Return Date Locked',
            status: 409,
            detail: 'The return date can only be changed while the loan is pending or active.',
            instance: `/v1/loans/${params.id}`,
            timestamp: '2026-10-28T10:00:00Z',
            requestId: 'req-mock',
          },
          { status: 409 },
        );
      }),
    );

    await openEditDialog();
    fireEvent.press(screen.getByTestId('edit-return-date-input'));
    fireEvent.press(screen.getByTestId('mock-calendar-select'));
    fireEvent.changeText(screen.getByTestId('edit-notes-input'), 'new notes');
    fireEvent.press(screen.getByTestId('confirm-edit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('edit-api-error')).toBeTruthy();
    });
    expect(
      screen.getByText('The return date can no longer be changed for this loan.'),
    ).toBeTruthy();
    expect(screen.getByTestId('edit-loan-dialog')).toBeTruthy();
    expect(screen.getByTestId('edit-notes-input').props.value).toBe('new notes');
    await waitFor(() => {
      expect(screen.getByTestId('return-date-locked-hint')).toBeTruthy();
    });
    expect(screen.queryByTestId('edit-return-date-input')).toBeNull();
  });

  it('closes the edit dialog once the changes are saved', async () => {
    serveLoanWithStatus('ACTIVE');
    const captured = capturePatchBody();

    await openEditDialog();
    fireEvent.changeText(screen.getByTestId('edit-notes-input'), 'new notes');
    fireEvent.press(screen.getByTestId('confirm-edit-btn'));

    // Asserts our screen's decision (the dialog is asked to hide once the save resolved),
    // not Paper's hide animation, which does not advance while RNTL waits inside act().
    await waitFor(() => {
      expect(captured.body).toEqual({ notes: 'new notes' });
      expect(editDialog()?.props.visible).toBe(false);
    });
  });
});

describe('LoanDetailScreen — actions never unmount the screen', () => {
  /** A request that stays pending until `release()` is called. */
  function gate() {
    let release!: () => void;
    const opened = new Promise<void>((resolve) => {
      release = resolve;
    });
    return { opened, release };
  }

  it('keeps the screen and the edit dialog mounted while the change is being saved', async () => {
    const { opened, release } = gate();
    server.use(
      http.patch('http://localhost:3000/v1/loans/:id', async ({ request }) => {
        await opened;
        const body = (await request.json()) as Record<string, unknown>;
        // The API answers with the full updated loan.
        return HttpResponse.json(
          { ...useLoanStore.getState().selectedLoan, ...body },
          { status: 200 },
        );
      }),
    );
    renderDetailScreen();
    await waitFor(() => {
      expect(screen.getByTestId('edit-loan-btn')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('edit-loan-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('edit-loan-dialog')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByTestId('edit-notes-input'), 'new notes');
    fireEvent.press(screen.getByTestId('confirm-edit-btn'));

    await waitFor(() => {
      expect(useLoanStore.getState().isLoading).toBe(true);
    });
    expect(screen.queryByTestId('loading')).toBeNull();
    expect(screen.getByTestId('edit-loan-dialog')).toBeTruthy();
    release();
    await waitFor(() => {
      expect(useLoanStore.getState().isLoading).toBe(false);
    });
  });
});
