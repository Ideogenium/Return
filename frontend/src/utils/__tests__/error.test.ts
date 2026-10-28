import { getErrorMessage, extractProblemDetails, getFieldErrors } from '../error';
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

describe('getFieldErrors', () => {
  const validationProblem = (errors: Array<{ field: string; code: string; message: string }>) =>
    ({
      type: 'https://api.return.app/errors/validation-failed',
      title: 'Validation Failed',
      status: 400,
      detail: 'The request contains invalid data.',
      instance: '/v1/auth/register',
      timestamp: '2026-10-28T10:00:00Z',
      requestId: 'req-1',
      errors,
    }) as ProblemDetails;

  it('maps a refused password format to the explicit password rules', () => {
    const fields = getFieldErrors(
      validationProblem([{ field: 'password', code: 'INVALID_FORMAT', message: 'x' }]),
      mockT,
    );

    expect(fields).toEqual({ password: 'auth.passwordRules' });
  });

  it('maps the new password of a password change the same way', () => {
    expect(
      getFieldErrors(
        validationProblem([{ field: 'newPassword', code: 'INVALID_FORMAT', message: 'x' }]),
        mockT,
      ),
    ).toEqual({ newPassword: 'auth.passwordRules' });
  });

  it('maps an invalid email and name lengths to their localized messages', () => {
    expect(
      getFieldErrors(
        validationProblem([
          { field: 'email', code: 'INVALID_EMAIL', message: 'x' },
          { field: 'firstName', code: 'TOO_LONG', message: 'x' },
        ]),
        mockT,
      ),
    ).toEqual({ email: 'auth.emailInvalid', firstName: 'auth.nameMaxLength' });
  });

  it('falls back to a generic field message for an unknown code', () => {
    expect(
      getFieldErrors(
        validationProblem([{ field: 'lastName', code: 'WHATEVER', message: 'x' }]),
        mockT,
      ),
    ).toEqual({ lastName: 'errors.fieldInvalid' });
  });

  it('returns nothing for a problem that is not a field validation error', () => {
    expect(
      getFieldErrors(
        { ...validationProblem([]), type: 'https://api.return.app/errors/email-already-exists' },
        mockT,
      ),
    ).toEqual({});
  });
});
