import { getErrorMessage, extractProblemDetails } from '../error';
import type { ProblemDetails } from '../../types/api.types';

const mockT = ((key: string) => key) as unknown as import('i18next').TFunction;

describe('getErrorMessage', () => {
  it('should return i18n key for mapped error types', () => {
    const error: ProblemDetails = {
      type: 'https://api.return.app/errors/invalid-credentials',
      title: 'Invalid Credentials',
      status: 401,
      detail: 'Invalid email or password.',
      instance: '/v1/auth/login',
      timestamp: '2026-01-01T00:00:00Z',
      requestId: 'req-1',
    };

    expect(getErrorMessage(error, mockT)).toBe('errors.invalidCredentials');
  });

  it('should return i18n key for invalid-return-date', () => {
    const error: ProblemDetails = {
      type: 'https://api.return.app/errors/invalid-return-date',
      title: 'Invalid Return Date',
      status: 400,
      detail: 'Return date must be in the future.',
      instance: '/v1/loans',
      timestamp: '2026-01-01T00:00:00Z',
      requestId: 'req-1',
    };

    expect(getErrorMessage(error, mockT)).toBe('errors.invalidReturnDate');
  });

  it('should return i18n key for loan-return-date-locked', () => {
    const error: ProblemDetails = {
      type: 'https://api.return.app/errors/loan-return-date-locked',
      title: 'Return Date Locked',
      status: 409,
      detail: 'The return date can only be changed while the loan is pending or active.',
      instance: '/v1/loans/loan-123',
      timestamp: '2026-01-01T00:00:00Z',
      requestId: 'req-1',
    };

    expect(getErrorMessage(error, mockT)).toBe('errors.loanReturnDateLocked');
  });

  it('should fallback to detail for unmapped error types', () => {
    const error: ProblemDetails = {
      type: 'https://api.return.app/errors/some-unknown-error',
      title: 'Unknown',
      status: 500,
      detail: 'Something went wrong.',
      instance: '/v1/something',
      timestamp: '2026-01-01T00:00:00Z',
      requestId: 'req-1',
    };

    expect(getErrorMessage(error, mockT)).toBe('Something went wrong.');
  });
});

describe('extractProblemDetails', () => {
  it('should extract ProblemDetails from Axios-like error', () => {
    const err = {
      response: {
        data: {
          type: 'https://api.return.app/errors/loan-not-found',
          title: 'Not Found',
          status: 404,
          detail: 'Loan not found.',
          instance: '/v1/loans/123',
          timestamp: '2026-01-01T00:00:00Z',
          requestId: 'req-1',
        },
      },
    };

    const result = extractProblemDetails(err);
    expect(result.type).toBe('https://api.return.app/errors/loan-not-found');
    expect(result.status).toBe(404);
  });

  it('should return network-error fallback for non-RFC errors', () => {
    const result = extractProblemDetails(new Error('Network failed'));
    expect(result.type).toBe('https://api.return.app/errors/network-error');
    expect(result.status).toBe(0);
  });
});
