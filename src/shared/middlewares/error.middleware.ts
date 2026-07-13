import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '@shared/utils/api-error';
import { logger } from '@shared/utils/logger';
import { config } from '@shared/config/env';

export const errorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Log the error
  logger.error(err.message, { stack: err.stack });

  // Handle ApiError (operational errors)
  if (err instanceof ApiError) {
    const hasCustomCode = err.message.includes('|');
    const customCode = hasCustomCode 
      ? err.message.split('|')[0] 
      : err.constructor.name.replace(/Error$/, '').toUpperCase();
      
    const messageText = hasCustomCode ? err.message.split('|')[1] : err.message;

    res.status(err.statusCode).json({
      success: false,
      code: err.statusCode,
      message: err.error ? err.error : {
        code: customCode,
        message: messageText
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle Mongoose validation error
  if (err.name === 'ValidationError') {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      code: StatusCodes.BAD_REQUEST,
      message: {
        code: 'VALIDATION_ERROR',
        message: err.message
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      code: StatusCodes.BAD_REQUEST,
      message: {
        code: 'INVALID_ID',
        message: 'Invalid ID format'
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle Mongoose duplicate key error
  if ('code' in err && (err as Record<string, unknown>).code === 11000) {
    res.status(StatusCodes.CONFLICT).json({
      success: false,
      code: StatusCodes.CONFLICT,
      message: {
        code: 'DUPLICATE_FIELD',
        message: 'Duplicate field value'
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      code: StatusCodes.UNAUTHORIZED,
      message: {
        code: 'INVALID_TOKEN',
        message: 'Invalid token'
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      code: StatusCodes.UNAUTHORIZED,
      message: {
        code: 'TOKEN_EXPIRED',
        message: 'Token expired'
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Unhandled errors
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    code: StatusCodes.INTERNAL_SERVER_ERROR,
    message: {
      code: 'INTERNAL_SERVER_ERROR',
      message: config.isDevelopment ? err.message : 'Internal server error'
    },
    ...(config.isDevelopment && { stack: err.stack }),
    timestamp: new Date().toISOString(),
  });
};
