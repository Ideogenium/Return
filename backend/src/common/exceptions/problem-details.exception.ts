import { HttpException, HttpStatus } from '@nestjs/common';
import { getRequestId } from '../middleware/request-context.middleware.js';

export interface ErrorDetail {
  field: string;
  code: string;
  message: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  timestamp: string;
  requestId: string;
  errors?: ErrorDetail[];
}

export class ProblemDetailsException extends HttpException {
  constructor(
    status: HttpStatus,
    type: string,
    title: string,
    detail: string,
    instance: string,
    errors?: ErrorDetail[],
  ) {
    const body: ProblemDetails = {
      type: `https://api.return.app/errors/${type}`,
      title,
      status,
      detail,
      instance,
      timestamp: new Date().toISOString(),
      requestId: getRequestId(),
      errors,
    };
    super(body, status);
  }
}

// --- Concrete exception classes ---

export class NotFoundException extends ProblemDetailsException {
  constructor(resource: string, id: string, path: string) {
    // "DeviceToken" → slug "device-token" (contract: device-token-not-found), words "device token".
    const words = resource.replace(/([a-z])([A-Z])/g, '$1 $2');
    super(
      HttpStatus.NOT_FOUND,
      `${words.toLowerCase().replace(/ /g, '-')}-not-found`,
      `${words} Not Found`,
      `The ${words.toLowerCase()} with ID '${id}' does not exist.`,
      path,
    );
  }
}

export class ConflictException extends ProblemDetailsException {
  constructor(type: string, title: string, detail: string, path: string) {
    super(HttpStatus.CONFLICT, type, title, detail, path);
  }
}

export class ForbiddenException extends ProblemDetailsException {
  constructor(type: string, title: string, detail: string, path: string) {
    super(HttpStatus.FORBIDDEN, type, title, detail, path);
  }
}

export class UnauthorizedException extends ProblemDetailsException {
  constructor(type: string, title: string, detail: string, path: string) {
    super(HttpStatus.UNAUTHORIZED, type, title, detail, path);
  }
}

export class RateLimitException extends ProblemDetailsException {
  constructor(
    detail: string,
    path: string,
    type = 'rate-limit-exceeded',
    title = 'Rate Limit Exceeded',
  ) {
    super(HttpStatus.TOO_MANY_REQUESTS, type, title, detail, path);
  }
}

export class BadRequestException extends ProblemDetailsException {
  constructor(type: string, title: string, detail: string, path: string) {
    super(HttpStatus.BAD_REQUEST, type, title, detail, path);
  }
}
