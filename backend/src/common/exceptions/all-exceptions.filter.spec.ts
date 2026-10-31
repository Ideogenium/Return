import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { UnauthorizedException } from './problem-details.exception.js';
import type { ProblemDetails } from './problem-details.exception.js';

// =============================================================================
// AllExceptionsFilter — Tests unitaires
// =============================================================================
// Vérifie que TOUTES les erreurs API retournent du RFC 7807 (ProblemDetails).
//
// Cas couverts :
//   1. ProblemDetailsException → body passé tel quel
//   2. BadRequest avec erreurs structurées (exceptionFactory custom)
//   3. BadRequest avec erreurs string[] (format legacy)
//   4. HttpException générique (404, etc.)
//   5. Exception non-HTTP (erreur inattendue) → 500
// =============================================================================

// --- Mock de l'ArgumentsHost (Express) ---

function createMockHost(url = '/v1/test') {
  const json = jest.fn();
  const setHeader = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnValue({ setHeader, json });

  const response = { status, setHeader, json } as unknown as Record<string, jest.Mock>;
  const request = { url } as unknown as Record<string, string>;

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, response, json, status };
}

// Mock getRequestId pour contrôler la valeur dans les tests
jest.mock('../middleware/request-context.middleware.js', () => ({
  getRequestId: () => 'test-request-id',
}));

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  // =========================================================================
  // 1. ProblemDetailsException — RFC 7807 direct
  // =========================================================================

  it('should pass ProblemDetailsException body directly as application/problem+json', () => {
    // Arrange
    const exception = new UnauthorizedException(
      'invalid-credentials',
      'Invalid Credentials',
      'Email or password is incorrect.',
      '/v1/auth/login',
    );
    const { host, status, json } = createMockHost('/v1/auth/login');

    // Act
    filter.catch(exception, host);

    // Assert — Le body est retourné tel quel avec le bon Content-Type
    expect(status).toHaveBeenCalledWith(401);
    const body = json.mock.calls[0]![0] as ProblemDetails;
    expect(body.type).toBe('https://api.return.app/errors/invalid-credentials');
    expect(body.title).toBe('Invalid Credentials');
    expect(body.status).toBe(401);
    expect(body.detail).toBe('Email or password is incorrect.');
    expect(body.instance).toBe('/v1/auth/login');
    expect(body.requestId).toBe('test-request-id');
    expect(body.timestamp).toBeDefined();
  });

  // =========================================================================
  // 2. BadRequest avec erreurs structurées (exceptionFactory custom)
  // =========================================================================

  it('should handle structured validation errors with correct field names', () => {
    // Arrange — Format produit par le exceptionFactory custom de main.ts
    const structuredErrors = [
      { field: 'email', code: 'VALIDATION_ERROR', message: 'email must be an email' },
      {
        field: 'password',
        code: 'VALIDATION_ERROR',
        message: 'password must be longer than or equal to 8 characters',
      },
    ];
    const exception = new BadRequestException({
      message: structuredErrors,
      error: 'Validation Failed',
    });
    const { host, status, json } = createMockHost('/v1/auth/register');

    // Act
    filter.catch(exception, host);

    // Assert — RFC 7807 avec errors[] utilisant les vrais noms de champs
    expect(status).toHaveBeenCalledWith(400);
    const body = json.mock.calls[0]![0] as ProblemDetails;
    expect(body.type).toBe('https://api.return.app/errors/validation-failed');
    expect(body.title).toBe('Validation Failed');
    expect(body.errors).toHaveLength(2);
    expect(body.errors![0]).toEqual({
      field: 'email',
      code: 'VALIDATION_ERROR',
      message: 'email must be an email',
    });
    expect(body.errors![1]).toEqual({
      field: 'password',
      code: 'VALIDATION_ERROR',
      message: 'password must be longer than or equal to 8 characters',
    });
    expect(body.detail).toBe('The request contains invalid data.');
  });

  // =========================================================================
  // 3. BadRequest avec erreurs string[] (format legacy NestJS)
  // =========================================================================

  it('should handle legacy string[] validation errors with regex field extraction', () => {
    // Arrange — Format par défaut de la ValidationPipe NestJS (sans custom factory)
    const exception = new BadRequestException({
      message: ['firstName must be longer than or equal to 1 characters'],
      error: 'Bad Request',
    });
    const { host, status, json } = createMockHost('/v1/users/me');

    // Act
    filter.catch(exception, host);

    // Assert — Fallback regex extrait le premier mot comme nom de champ
    expect(status).toHaveBeenCalledWith(400);
    const body = json.mock.calls[0]![0] as ProblemDetails;
    expect(body.errors).toHaveLength(1);
    expect(body.errors![0].field).toBe('firstName');
    expect(body.errors![0].code).toBe('VALIDATION_ERROR');
  });

  // =========================================================================
  // 4. HttpException générique (ex: 404 Not Found)
  // =========================================================================

  it('should format generic HttpException as RFC 7807', () => {
    // Arrange
    const exception = new HttpException('Not Found', 404);
    const { host, status, json } = createMockHost('/v1/loans/xyz');

    // Act
    filter.catch(exception, host);

    // Assert
    expect(status).toHaveBeenCalledWith(404);
    const body = json.mock.calls[0]![0] as ProblemDetails;
    expect(body.type).toBe('https://api.return.app/errors/not-found');
    expect(body.status).toBe(404);
    expect(body.instance).toBe('/v1/loans/xyz');
    expect(body.requestId).toBe('test-request-id');
    // Pas de errors[] pour une exception non-validation
    expect(body.errors).toBeUndefined();
  });

  it('should format 429 HttpException with rate-limit-exceeded type', () => {
    // Arrange
    const exception = new HttpException('Too Many Requests', 429);
    const { host, status, json } = createMockHost('/v1/auth/login');

    // Act
    filter.catch(exception, host);

    // Assert
    expect(status).toHaveBeenCalledWith(429);
    const body = json.mock.calls[0]![0] as ProblemDetails;
    expect(body.type).toBe('https://api.return.app/errors/rate-limit-exceeded');
    expect(body.title).toBe('Rate Limit Exceeded');
  });

  it('should format 401 HttpException with unauthorized type (Passport rejection)', () => {
    // Arrange — Simule un rejet Passport (token manquant/expiré)
    const exception = new HttpException('Unauthorized', 401);
    const { host, status, json } = createMockHost('/v1/users/me');

    // Act
    filter.catch(exception, host);

    // Assert
    expect(status).toHaveBeenCalledWith(401);
    const body = json.mock.calls[0]![0] as ProblemDetails;
    expect(body.type).toBe('https://api.return.app/errors/unauthorized');
    expect(body.title).toBe('Unauthorized');
  });

  // =========================================================================
  // 5. Exception non-HTTP (erreur inattendue) → 500
  // =========================================================================

  it('should return 500 for unhandled non-HTTP exceptions', () => {
    // Arrange — Erreur runtime inattendue
    const exception = new Error('Database connection lost');
    const { host, status, json } = createMockHost('/v1/users/me');

    // Act
    filter.catch(exception, host);

    // Assert
    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0]![0] as ProblemDetails;
    expect(body.type).toBe('https://api.return.app/errors/internal-server-error');
    expect(body.title).toBe('Internal Server Error');
    expect(body.detail).toBe('An unexpected error occurred');
    // Le message d'erreur interne ne doit PAS fuiter dans la réponse (sécurité)
    expect(body.detail).not.toContain('Database connection lost');
    expect(body.requestId).toBe('test-request-id');
  });

  it('should handle non-Error thrown values (strings, objects)', () => {
    // Arrange — throw 'something' au lieu de throw new Error(...)
    const { host, status, json } = createMockHost('/v1/users/me');

    // Act
    filter.catch('unexpected string throw', host);

    // Assert
    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0]![0] as ProblemDetails;
    expect(body.type).toBe('https://api.return.app/errors/internal-server-error');
  });

  // =========================================================================
  // 6. Erreurs 400 à message texte : upload (ParseFilePipe, Multer) et UUID
  // =========================================================================
  // Chaque message réel de NestJS 11 / Multer reçoit son propre code du contrat
  // (ErrorDetail.code) ; plus aucun 400 inconnu n'est étiqueté INVALID_UUID.

  function firstError(exception: unknown) {
    const { host, status, json } = createMockHost('/v1/items/abc/photos');
    filter.catch(exception, host);
    const body = json.mock.calls[0]![0] as ProblemDetails;
    return { status, body, error: body.errors![0] };
  }

  it.each([
    [
      'MaxFileSizeValidator with the file size',
      'Validation failed (current file size is 6000000, expected size is less than 5242880)',
    ],
    [
      'MaxFileSizeValidator without the file size',
      'Validation failed (expected size is less than 5242880)',
    ],
  ])('maps a %s message to TOO_LARGE on the file field', (_label, message) => {
    const { status, body, error } = firstError(new BadRequestException(message));

    expect(status).toHaveBeenCalledWith(400);
    expect(body.type).toBe('https://api.return.app/errors/validation-failed');
    expect(error).toEqual({ field: 'file', code: 'TOO_LARGE', message });
  });

  it.each([
    [
      'FileTypeValidator with the file type',
      'Validation failed (current file type is image/gif, expected type is /(jpeg|jpg|png)$/)',
    ],
    [
      'FileTypeValidator without the file type',
      'Validation failed (expected type is /(jpeg|jpg|png)$/)',
    ],
    ['a missing file', 'File is required'],
  ])(
    'maps %s to FILE_REQUIRED on the file field (contract: absent or refused type)',
    (_label, message) => {
      const { status, error } = firstError(new BadRequestException(message));

      expect(status).toHaveBeenCalledWith(400);
      expect(error).toEqual({ field: 'file', code: 'FILE_REQUIRED', message });
    },
  );

  it('maps a file over the Multer limit (413 File too large) to a 400 TOO_LARGE, as the contract says', () => {
    const { status, body, error } = firstError(new PayloadTooLargeException('File too large'));

    expect(status).toHaveBeenCalledWith(400);
    expect(body.status).toBe(400);
    expect(body.type).toBe('https://api.return.app/errors/validation-failed');
    expect(error).toEqual({ field: 'file', code: 'TOO_LARGE', message: 'File too large' });
  });

  it('keeps any other 413 as a generic error', () => {
    const { host, status, json } = createMockHost();
    filter.catch(new PayloadTooLargeException('Request body too large'), host);

    expect(status).toHaveBeenCalledWith(413);
    expect((json.mock.calls[0]![0] as ProblemDetails).errors).toBeUndefined();
  });

  it.each([
    'Too many files',
    'Unexpected field - picture',
    'Too many parts',
    'Too many fields',
    'Field value too long',
    'Multipart: Boundary not found',
    'Multipart: Unexpected end of form',
  ])('maps the multipart error "%s" to VALIDATION_ERROR on the file field', (message) => {
    const { status, error } = firstError(new BadRequestException(message));

    expect(status).toHaveBeenCalledWith(400);
    expect(error).toEqual({ field: 'file', code: 'VALIDATION_ERROR', message });
  });

  it.each(['Validation failed (uuid is expected)', 'Validation failed (uuid v 4 is expected)'])(
    'maps the ParseUUIDPipe message "%s" to INVALID_UUID on id',
    (message) => {
      const { status, error } = firstError(new BadRequestException(message));

      expect(status).toHaveBeenCalledWith(400);
      expect(error).toEqual({ field: 'id', code: 'INVALID_UUID', message });
    },
  );

  it('no longer labels an unknown 400 as INVALID_UUID: generic VALIDATION_ERROR', () => {
    const { status, error } = firstError(new BadRequestException('Something else went wrong'));

    expect(status).toHaveBeenCalledWith(400);
    expect(error).toEqual({
      field: 'unknown',
      code: 'VALIDATION_ERROR',
      message: 'Something else went wrong',
    });
  });
});
