import { StatusCodes } from 'http-status-codes';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly error?: unknown;

  constructor(statusCode: number, message: string, isOperational = true, error?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.error = error;
    Object.setPrototypeOf(this, ApiError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource = 'Resource') {
    super(StatusCodes.NOT_FOUND, `${resource} not found`);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(StatusCodes.UNAUTHORIZED, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(StatusCodes.FORBIDDEN, message);
  }
}

export class BadRequestError extends ApiError {
  constructor(message = 'Bad request', error?: unknown) {
    super(StatusCodes.BAD_REQUEST, message, true, error);
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Resource already exists') {
    super(StatusCodes.CONFLICT, message);
  }
}
