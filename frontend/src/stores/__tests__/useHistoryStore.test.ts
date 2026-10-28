import { http, HttpResponse } from 'msw';
import { server } from '../../../__mocks__/server';
import { useHistoryStore } from '../useHistoryStore';

const API_BASE = 'http://localhost:3000/v1';

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  useHistoryStore.getState().reset();
});
afterAll(() => server.close());

describe('useHistoryStore', () => {
  describe('fetchStatistics', () => {
    it('should fetch and store statistics from the API', async () => {
      await useHistoryStore.getState().fetchStatistics();

      const state = useHistoryStore.getState();
      expect(state.statistics).not.toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should populate statistics.overview with values from the API', async () => {
      await useHistoryStore.getState().fetchStatistics();

      const overview = useHistoryStore.getState().statistics?.overview;
      // Default handler (handlers.ts) returns totalLoans=3, activeLoans=1, returnedLoans=2
      expect(overview?.totalLoans).toBe(3);
      expect(overview?.activeLoans).toBe(1);
      expect(overview?.returnedLoans).toBe(2);
    });

    it('should set isLoading to true while request is in flight and false after', async () => {
      const promise = useHistoryStore.getState().fetchStatistics();

      expect(useHistoryStore.getState().isLoading).toBe(true);

      await promise;

      expect(useHistoryStore.getState().isLoading).toBe(false);
    });

    it('should leave statistics null and set error on 500 response (silent fail — no throw)', async () => {
      server.use(
        http.get(`${API_BASE}/history/statistics`, () => {
          return HttpResponse.json(
            {
              type: 'https://api.return.app/errors/internal-server-error',
              title: 'Internal Server Error',
              status: 500,
              detail: 'An unexpected error occurred.',
              instance: '/history/statistics',
              timestamp: '2026-06-23T10:00:00Z',
              requestId: 'req-mock',
            },
            { status: 500 },
          );
        }),
      );

      // fetchStatistics fails silently — it must NOT throw
      await expect(useHistoryStore.getState().fetchStatistics()).resolves.toBeUndefined();

      const state = useHistoryStore.getState();
      expect(state.statistics).toBeNull();
      expect(state.error).not.toBeNull();
      expect(state.error?.status).toBe(500);
      expect(state.isLoading).toBe(false);
    });

    it('should clear error before each new fetch attempt', async () => {
      // Simulate a previous error state
      useHistoryStore.setState({
        error: {
          type: 'https://api.return.app/errors/internal-server-error',
          title: 'Previous Error',
          status: 500,
          detail: 'Previous failure.',
          instance: '/history/statistics',
          timestamp: '2026-06-23T10:00:00Z',
          requestId: 'req-old',
        },
      });

      await useHistoryStore.getState().fetchStatistics();

      expect(useHistoryStore.getState().error).toBeNull();
    });
  });

  describe('fetchArchivedLoans', () => {
    it('should load the first page of archived loans with its pagination metadata', async () => {
      await useHistoryStore.getState().fetchArchivedLoans();

      const state = useHistoryStore.getState();
      expect(state.loans).toHaveLength(20);
      expect(state.loans[0]?.id).toBe('history-loan-1');
      expect(state.pagination?.currentPage).toBe(1);
      expect(state.pagination?.totalItems).toBe(25);
      expect(state.pagination?.hasNextPage).toBe(true);
      expect(state.isLoadingLoans).toBe(false);
      expect(state.loansError).toBeNull();
    });

    it('should flag isLoadingLoans while the request is in flight', async () => {
      const promise = useHistoryStore.getState().fetchArchivedLoans();

      expect(useHistoryStore.getState().isLoadingLoans).toBe(true);

      await promise;

      expect(useHistoryStore.getState().isLoadingLoans).toBe(false);
    });

    it('should store the error and keep an empty list on failure (no throw)', async () => {
      server.use(
        http.get(`${API_BASE}/history/loans`, () =>
          HttpResponse.json(
            {
              type: 'https://api.return.app/errors/internal-server-error',
              title: 'Internal Server Error',
              status: 500,
              detail: 'Boom',
              instance: '/history/loans',
              timestamp: '2026-06-23T10:00:00Z',
              requestId: 'req-mock',
            },
            { status: 500 },
          ),
        ),
      );

      await expect(useHistoryStore.getState().fetchArchivedLoans()).resolves.toBeUndefined();

      const state = useHistoryStore.getState();
      expect(state.loans).toEqual([]);
      expect(state.loansError?.status).toBe(500);
      expect(state.isLoadingLoans).toBe(false);
    });

    it('should replace the list instead of appending when called again', async () => {
      await useHistoryStore.getState().fetchArchivedLoans();
      await useHistoryStore.getState().fetchArchivedLoans();

      expect(useHistoryStore.getState().loans).toHaveLength(20);
    });
  });

  describe('fetchNextArchivedLoans', () => {
    it('should append the next page and advance the pagination', async () => {
      await useHistoryStore.getState().fetchArchivedLoans();

      await useHistoryStore.getState().fetchNextArchivedLoans();

      const state = useHistoryStore.getState();
      expect(state.loans).toHaveLength(25);
      expect(state.loans[24]?.id).toBe('history-loan-25');
      expect(state.pagination?.currentPage).toBe(2);
      expect(state.pagination?.hasNextPage).toBe(false);
      expect(state.isLoadingMore).toBe(false);
    });

    it('should do nothing when there is no next page', async () => {
      await useHistoryStore.getState().fetchArchivedLoans();
      await useHistoryStore.getState().fetchNextArchivedLoans();
      let requestCount = 0;
      server.use(
        http.get(`${API_BASE}/history/loans`, () => {
          requestCount += 1;
          return HttpResponse.json({}, { status: 500 });
        }),
      );

      await useHistoryStore.getState().fetchNextArchivedLoans();

      expect(requestCount).toBe(0);
      expect(useHistoryStore.getState().loans).toHaveLength(25);
    });

    it('should ignore concurrent calls while a page is already loading', async () => {
      await useHistoryStore.getState().fetchArchivedLoans();
      let requestCount = 0;
      server.events.on('request:start', ({ request }) => {
        if (request.url.includes('/history/loans')) requestCount += 1;
      });

      await Promise.all([
        useHistoryStore.getState().fetchNextArchivedLoans(),
        useHistoryStore.getState().fetchNextArchivedLoans(),
      ]);
      server.events.removeAllListeners();

      expect(requestCount).toBe(1);
      expect(useHistoryStore.getState().loans).toHaveLength(25);
    });

    it('should keep the loaded loans and expose the error when the next page fails', async () => {
      await useHistoryStore.getState().fetchArchivedLoans();
      server.use(
        http.get(`${API_BASE}/history/loans`, () =>
          HttpResponse.json(
            {
              type: 'https://api.return.app/errors/internal-server-error',
              title: 'Internal Server Error',
              status: 500,
              detail: 'Boom',
              instance: '/history/loans',
              timestamp: '2026-06-23T10:00:00Z',
              requestId: 'req-mock',
            },
            { status: 500 },
          ),
        ),
      );

      await useHistoryStore.getState().fetchNextArchivedLoans();

      const state = useHistoryStore.getState();
      expect(state.loans).toHaveLength(20);
      expect(state.pagination?.currentPage).toBe(1);
      expect(state.loansError?.status).toBe(500);
      expect(state.isLoadingMore).toBe(false);
    });
  });

  describe('setStatusFilter', () => {
    it('should reload page 1 with only loans of the selected status', async () => {
      await useHistoryStore.getState().fetchArchivedLoans();

      await useHistoryStore.getState().setStatusFilter('RETURNED');

      const state = useHistoryStore.getState();
      expect(state.statusFilter).toBe('RETURNED');
      expect(state.loans).toHaveLength(7);
      expect(state.loans.every((loan) => loan.status === 'RETURNED')).toBe(true);
      expect(state.pagination?.currentPage).toBe(1);
    });

    it('should keep the filter when loading the next page', async () => {
      await useHistoryStore.getState().setStatusFilter('RETURNED');
      let requestedStatus: string | null = null;
      server.use(
        http.get(`${API_BASE}/history/loans`, ({ request }) => {
          requestedStatus = new URL(request.url).searchParams.get('status');
          return HttpResponse.json({ data: [], pagination: {} });
        }),
      );
      useHistoryStore.setState({
        pagination: {
          currentPage: 1,
          totalPages: 2,
          totalItems: 30,
          itemsPerPage: 20,
          hasNextPage: true,
          hasPreviousPage: false,
        },
      });

      await useHistoryStore.getState().fetchNextArchivedLoans();

      expect(requestedStatus).toBe('RETURNED');
    });

    it('should clear the filter when called with null', async () => {
      await useHistoryStore.getState().setStatusFilter('ABANDONED');

      await useHistoryStore.getState().setStatusFilter(null);

      const state = useHistoryStore.getState();
      expect(state.statusFilter).toBeNull();
      expect(state.loans).toHaveLength(20);
    });

    it('should ignore a stale response when the filter changes during a request', async () => {
      const slow = useHistoryStore.getState().fetchArchivedLoans();

      await useHistoryStore.getState().setStatusFilter('NOT_RETURNED');
      await slow;

      const state = useHistoryStore.getState();
      expect(state.statusFilter).toBe('NOT_RETURNED');
      expect(state.loans.every((loan) => loan.status === 'NOT_RETURNED')).toBe(true);
    });
  });

  describe('reset (archived loans)', () => {
    it('should clear loans, pagination, filter and error', async () => {
      await useHistoryStore.getState().setStatusFilter('RETURNED');

      useHistoryStore.getState().reset();

      const state = useHistoryStore.getState();
      expect(state.loans).toEqual([]);
      expect(state.pagination).toBeNull();
      expect(state.statusFilter).toBeNull();
      expect(state.loansError).toBeNull();
      expect(state.isLoadingLoans).toBe(false);
      expect(state.isLoadingMore).toBe(false);
    });
  });

  describe('reset', () => {
    it('should restore initial state after fetchStatistics', async () => {
      await useHistoryStore.getState().fetchStatistics();
      expect(useHistoryStore.getState().statistics).not.toBeNull();

      useHistoryStore.getState().reset();

      const state = useHistoryStore.getState();
      expect(state.statistics).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
