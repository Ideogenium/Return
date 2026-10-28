import { http, HttpResponse } from 'msw';
import { server } from '../../../__mocks__/server';
import { useLoanStore } from '../useLoanStore';

const API_BASE = 'http://localhost:3000/v1';

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  useLoanStore.getState().reset();
});
afterAll(() => server.close());

describe('useLoanStore', () => {
  describe('fetchLoans', () => {
    it('should fetch and store loans list', async () => {
      await useLoanStore.getState().fetchLoans();

      const state = useLoanStore.getState();
      expect(state.loans).toHaveLength(1);
      expect(state.loans[0]!.status).toBe('ACTIVE');
      expect(state.loans[0]!.borrower.firstName).toBe('Marie');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should pass role=borrower query param', async () => {
      let capturedUrl = '';
      server.use(
        http.get(`${API_BASE}/loans`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json(
            {
              data: [],
              pagination: {
                currentPage: 1,
                itemsPerPage: 20,
                totalItems: 0,
                totalPages: 0,
                hasNextPage: false,
                hasPreviousPage: false,
              },
            },
            { status: 200 },
          );
        }),
      );

      await useLoanStore.getState().fetchLoans({ role: 'borrower' });

      expect(capturedUrl).toContain('role=borrower');
      expect(useLoanStore.getState().isLoading).toBe(false);
    });

    it('should set error on fetch failure', async () => {
      server.use(
        http.get(`${API_BASE}/loans`, () => {
          return HttpResponse.json(
            {
              type: 'https://api.return.app/errors/internal-server-error',
              title: 'Server Error',
              status: 500,
              detail: 'Internal server error.',
              instance: '/loans',
              timestamp: '2026-02-25T10:00:00Z',
              requestId: 'req-mock',
            },
            { status: 500 },
          );
        }),
      );

      await expect(useLoanStore.getState().fetchLoans()).rejects.toThrow();

      const state = useLoanStore.getState();
      expect(state.loans).toHaveLength(0);
      expect(state.isLoading).toBe(false);
      expect(state.error).not.toBeNull();
    });
  });

  describe('fetchLoan', () => {
    it('should fetch and store a single loan', async () => {
      await useLoanStore.getState().fetchLoan('7f3c9a2b-4d1e-4a8f-9c7b-1e3f5a6b8c9d');

      const state = useLoanStore.getState();
      expect(state.selectedLoan).not.toBeNull();
      expect(state.selectedLoan?.status).toBe('ACTIVE');
      expect(state.isLoading).toBe(false);
    });

    it('keeps the displayed loan while the same loan is being refreshed', async () => {
      await useLoanStore.getState().fetchLoan('7f3c9a2b-4d1e-4a8f-9c7b-1e3f5a6b8c9d');

      const pending = useLoanStore.getState().fetchLoan('7f3c9a2b-4d1e-4a8f-9c7b-1e3f5a6b8c9d');

      expect(useLoanStore.getState().selectedLoan?.id).toBe('7f3c9a2b-4d1e-4a8f-9c7b-1e3f5a6b8c9d');
      await pending;
    });

    it('drops the previous loan when another loan is requested, so it is never shown in its place', async () => {
      await useLoanStore.getState().fetchLoan('7f3c9a2b-4d1e-4a8f-9c7b-1e3f5a6b8c9d');

      const pending = useLoanStore.getState().fetchLoan('00000000-0000-4000-8000-000000000001');

      expect(useLoanStore.getState().selectedLoan).toBeNull();
      await pending.catch(() => {});
    });

    it('should set error on 404', async () => {
      await expect(useLoanStore.getState().fetchLoan('not-found')).rejects.toThrow();

      const state = useLoanStore.getState();
      expect(state.selectedLoan).toBeNull();
      expect(state.error?.status).toBe(404);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('createLoan', () => {
    it('should create and add loan to list', async () => {
      const newLoan = await useLoanStore.getState().createLoan({
        item: '9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
        borrowerId: '5d6e7f8a-1b2c-4d3e-a5f6-7a8b9c0d1e2f',
        returnDate: '2026-05-01',
        notes: 'Test loan',
      });

      expect(newLoan.id).toBe('new-loan-id-1234');

      const state = useLoanStore.getState();
      expect(state.loans).toHaveLength(1);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('updateLoan', () => {
    it('should update loan in list', async () => {
      await useLoanStore.getState().fetchLoans();

      const loanId = useLoanStore.getState().loans[0]!.id;
      const updated = await useLoanStore.getState().updateLoan(loanId, {
        notes: 'Updated notes',
      });

      expect(updated.notes).toBe('Updated notes');

      const state = useLoanStore.getState();
      expect(state.loans[0]!.notes).toBe('Updated notes');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('deleteLoan', () => {
    it('should remove loan from list', async () => {
      await useLoanStore.getState().fetchLoans();
      expect(useLoanStore.getState().loans).toHaveLength(1);

      const loanId = useLoanStore.getState().loans[0]!.id;
      await useLoanStore.getState().deleteLoan(loanId);

      const state = useLoanStore.getState();
      expect(state.loans).toHaveLength(0);
      expect(state.isLoading).toBe(false);
    });

    it('should set error on 409 (loan already returned)', async () => {
      server.use(
        http.delete(`${API_BASE}/loans/:id`, () => {
          return HttpResponse.json(
            {
              type: 'https://api.return.app/errors/loan-already-returned',
              title: 'Loan Already Returned',
              status: 409,
              detail: 'Cannot delete a loan that has already been returned.',
              instance: '/loans/some-id',
              timestamp: '2026-02-25T10:00:00Z',
              requestId: 'req-mock',
            },
            { status: 409 },
          );
        }),
      );

      await expect(useLoanStore.getState().deleteLoan('some-id')).rejects.toThrow();

      const state = useLoanStore.getState();
      expect(state.error?.status).toBe(409);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('confirmLoan', () => {
    it('should confirm loan and update status', async () => {
      await useLoanStore.getState().fetchLoans();

      const loanId = useLoanStore.getState().loans[0]!.id;
      const confirmed = await useLoanStore.getState().confirmLoan(loanId);

      expect(confirmed.status).toBe('ACTIVE');
      expect(confirmed.confirmationDate).toBeTruthy();
      expect(useLoanStore.getState().isLoading).toBe(false);
    });
  });

  describe('contestLoan', () => {
    it('should contest loan with reason', async () => {
      await useLoanStore.getState().fetchLoans();

      const loanId = useLoanStore.getState().loans[0]!.id;
      const contested = await useLoanStore
        .getState()
        .contestLoan(loanId, { reason: 'I never received this item' });

      expect(contested.status).toBe('CONTESTED');
      expect(contested.contestReason).toBe('I never received this item');
      expect(useLoanStore.getState().isLoading).toBe(false);
    });
  });

  describe('updateStatus', () => {
    it('should update loan status', async () => {
      await useLoanStore.getState().fetchLoans();

      const loanId = useLoanStore.getState().loans[0]!.id;
      const updated = await useLoanStore
        .getState()
        .updateStatus(loanId, { status: 'RETURNED', notes: 'All good' });

      expect(updated.status).toBe('RETURNED');
      expect(useLoanStore.getState().isLoading).toBe(false);
    });
  });
});
