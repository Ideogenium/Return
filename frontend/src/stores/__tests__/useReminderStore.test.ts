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
});
