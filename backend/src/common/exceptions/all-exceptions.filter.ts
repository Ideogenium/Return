import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProblemDetailsException, ProblemDetails } from './problem-details.exception.js';
import { getRequestId } from '../middleware/request-context.middleware.js';

/** Message of Multer's LIMIT_FILE_SIZE, turned by NestJS into a 413 PayloadTooLargeException. */
const MULTER_FILE_TOO_LARGE = 'File too large';

/** Multer and busboy messages for a malformed or abusive multipart body (see their limits). */
const MULTIPART_ERROR =
  /^(Too many (parts|files|fields)|Field (name|value) too long|Unexpected field|Field name missing|Multipart: |Malformed part header|Unexpected end of (form|file))/;

/**
 * Field and contract error code (ErrorDetail.code) of a 400 that only carries a message.
 * The messages are the ones of NestJS 11 (ParseFilePipe validators, ParseUUIDPipe) and Multer.
 */
function classifyBadRequestMessage(msg: string): { field: string; code: string } {
  if (
    msg === MULTER_FILE_TOO_LARGE ||
    /^Validation failed \((current file size is \d+, )?expected size is less than/.test(msg)
  ) {
    return { field: 'file', code: 'TOO_LARGE' };
  }
  // Contract: FILE_REQUIRED covers a missing file and a refused type.
  if (
    msg.includes('File is required') ||
    /^Validation failed \((current file type is .+, )?expected type is/.test(msg)
  ) {
    return { field: 'file', code: 'FILE_REQUIRED' };
  }
  if (MULTIPART_ERROR.test(msg)) {
    return { field: 'file', code: 'VALIDATION_ERROR' };
  }
  if (/^Validation failed \(uuid( v \d+)? is expected\)$/.test(msg)) {
    return { field: 'id', code: 'INVALID_UUID' };
  }
  return { field: 'unknown', code: 'VALIDATION_ERROR' };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof ProblemDetailsException) {
      const body = exception.getResponse() as ProblemDetails;
      response.status(body.status).setHeader('Content-Type', 'application/problem+json').json(body);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Handle class-validator errors (Bad Request with structured error details)
      // Le exceptionFactory custom dans main.ts envoie un tableau d'objets
      // { field, code, message } au lieu de simples strings.
      const messages =
        typeof exceptionResponse === 'object'
          ? (exceptionResponse as Record<string, unknown>).message
          : undefined;

      if (status === 400 && Array.isArray(messages)) {
        // Supporte les deux formats : string[] (legacy) et { field, code, message }[] (custom factory)
        const errors = messages.map((entry: unknown) => {
          if (typeof entry === 'object' && entry !== null && 'field' in entry) {
            // Format structuré du exceptionFactory custom
            const structured = entry as { field: string; code: string; message: string };
            return {
              field: structured.field,
              code: structured.code,
              message: structured.message,
            };
          }
          // Fallback legacy : essai d'extraction par regex
          const msg = String(entry);
          const match = /^(\w+)\s/.exec(msg);
          return {
            field: match?.[1] ?? 'unknown',
            code: 'VALIDATION_ERROR',
            message: msg,
          };
        });
        const body: ProblemDetails = {
          type: 'https://api.return.app/errors/validation-failed',
          title: 'Validation Failed',
          status,
          detail: 'The request contains invalid data.',
          instance: request.url,
          timestamp: new Date().toISOString(),
          requestId: getRequestId(),
          errors,
        };

        response.status(status).setHeader('Content-Type', 'application/problem+json').json(body);
        return;
      }

      // 400 with a plain message (ParseFilePipe, Multer, ParseUUIDPipe…) and Multer's 413 for a
      // file over its limit: the contract answers both with a 400 and a stable error code.
      if (status === 400 || (status === 413 && exception.message === MULTER_FILE_TOO_LARGE)) {
        let msg = exception.message;
        if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
          const messageField = (exceptionResponse as Record<string, unknown>).message;
          if (typeof messageField === 'string') {
            msg = messageField;
          }
        }
        const body: ProblemDetails = {
          type: 'https://api.return.app/errors/validation-failed',
          title: 'Validation Failed',
          status: 400,
          detail: 'The request contains invalid data.',
          instance: request.url,
          timestamp: new Date().toISOString(),
          requestId: getRequestId(),
          errors: [{ ...classifyBadRequestMessage(msg), message: msg }],
        };

        response.status(400).setHeader('Content-Type', 'application/problem+json').json(body);
        return;
      }

      const body: ProblemDetails = {
        type: `https://api.return.app/errors/${
          status === 401
            ? 'unauthorized'
            : status === 403
              ? 'forbidden'
              : status === 404
                ? 'not-found'
                : status === 429
                  ? 'rate-limit-exceeded'
                  : 'http-error'
        }`,
        title:
          status === 401
            ? 'Unauthorized'
            : status === 403
              ? 'Forbidden'
              : status === 429
                ? 'Rate Limit Exceeded'
                : exception.message,
        status,
        detail:
          status === 401
            ? 'No authorization token was found in the request headers.'
            : status === 403
              ? 'You do not have permission to access this resource.'
              : exception.message,
        instance: request.url,
        timestamp: new Date().toISOString(),
        requestId: getRequestId(),
      };

      response.status(status).setHeader('Content-Type', 'application/problem+json').json(body);
      return;
    }

    // Unhandled exception
    this.logger.error(
      `Unhandled exception on ${request.url}: ${exception instanceof Error ? exception.message : String(exception)}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    const body: ProblemDetails = {
      type: 'https://api.return.app/errors/internal-server-error',
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'An unexpected error occurred',
      instance: request.url,
      timestamp: new Date().toISOString(),
      requestId: getRequestId(),
    };

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .setHeader('Content-Type', 'application/problem+json')
      .json(body);
  }
}
