import { waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { server } from '../../../__mocks__/server';
import { useReminderStore } from '../useReminderStore';

const API_BASE = 'http://localhost:3000/v1';

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  useReminderStore.getState().reset();
});
afterAll(() => server.close());

describe('useReminderStore', () => {
  it('should fetch and store the reminders of a loan', async () => {
    await useReminderStore.getState().fetchLoanReminders('loan-1');

    const state = useReminderStore.getState();
    expect(state.loanId).toBe('loan-1');
    expect(state.reminders.length).toBeGreaterThan(0);
    expect(state.reminders[0]!.loanId).toBe('loan-1');
  });

  it('should call the loan reminders endpoint', async () => {
    let calledUrl = '';
    server.use(
      http.get(`${API_BASE}/loans/:id/reminders`, ({ request }) => {
        calledUrl = request.url;
        return HttpResponse.json([], { status: 200 });
      }),
    );

    await useReminderStore.getState().fetchLoanReminders('loan-42');

    expect(calledUrl).toBe(`${API_BASE}/loans/loan-42/reminders`);
    expect(useReminderStore.getState().reminders).toEqual([]);
  });

  it('should silently fall back to no reminders on network failure', async () => {
    server.use(http.get(`${API_BASE}/loans/:id/reminders`, () => HttpResponse.error()));

    await expect(useReminderStore.getState().fetchLoanReminders('loan-1')).resolves.toBeUndefined();

    expect(useReminderStore.getState().reminders).toEqual([]);
  });

  it('should silently fall back to no reminders on 403', async () => {
    server.use(
      http.get(`${API_BASE}/loans/:id/reminders`, () =>
        HttpResponse.json({ status: 403, title: 'Forbidden' }, { status: 403 }),
      ),
    );

    await useReminderStore.getState().fetchLoanReminders('loan-1');

    expect(useReminderStore.getState().reminders).toEqual([]);
  });

  it('should reset the state', async () => {
    await useReminderStore.getState().fetchLoanReminders('loan-1');

    useReminderStore.getState().reset();

    expect(useReminderStore.getState().reminders).toEqual([]);
    expect(useReminderStore.getState().loanId).toBeNull();
  });

  describe('concurrent requests', () => {
    // Handler whose response for each loan is released manually
    function holdReminders() {
      const gates = new Map<string, () => void>();
      server.use(
        http.get(`${API_BASE}/loans/:id/reminders`, async ({ params }) => {
          const loanId = String(params.id);
          await new Promise<void>((resolve) => gates.set(loanId, resolve));
          return HttpResponse.json(
            [
              {
                id: `reminder-${loanId}`,
                loanId,
                type: 'ON_DUE_DATE',
                status: 'SCHEDULED',
                scheduledFor: '2026-04-15T08:00:00Z',
                sentAt: null,
                channel: 'PUSH',
              },
            ],
            { status: 200 },
          );
        }),
      );
      return gates;
    }

    it('should keep the state of the latest fetch when responses arrive out of order', async () => {
      const gates = holdReminders();
      const fetchA = useReminderStore.getState().fetchLoanReminders('loan-a');
      const fetchB = useReminderStore.getState().fetchLoanReminders('loan-b');
      await waitFor(() => expect(gates.size).toBe(2));

      gates.get('loan-b')!();
      await fetchB;
      gates.get('loan-a')!(); // A answers last
      await fetchA;

      const state = useReminderStore.getState();
      expect(state.loanId).toBe('loan-b');
      expect(state.reminders.map((r) => r.loanId)).toEqual(['loan-b']);
    });

    it('should ignore a late response after a reset', async () => {
      const gates = holdReminders();
      const pending = useReminderStore.getState().fetchLoanReminders('loan-a');
      await waitFor(() => expect(gates.size).toBe(1));

      useReminderStore.getState().reset();
      gates.get('loan-a')!();
      await pending;

      const state = useReminderStore.getState();
      expect(state.loanId).toBeNull();
      expect(state.reminders).toEqual([]);
    });
  });
});
