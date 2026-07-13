import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';

interface ApiResponseData<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown[];
  timestamp: string;
}

export class ApiResponse {
  static success<T>(res: Response, data?: T, message = 'Success', statusCode = StatusCodes.OK) {
    const response: ApiResponseData<T> = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(response);
  }

  static created<T>(res: Response, data?: T, message = 'Created successfully') {
    return ApiResponse.success(res, data, message, StatusCodes.CREATED);
  }

  static noContent(res: Response) {
    return res.status(StatusCodes.NO_CONTENT).send();
  }

  static error(
    res: Response,
    message = 'Internal server error',
    statusCode = StatusCodes.INTERNAL_SERVER_ERROR,
    errors?: unknown[],
  ) {
    const response: ApiResponseData<null> = {
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(response);
  }

  static paginated<T>(
    res: Response,
    data: T[],
    page: number,
    limit: number,
    total: number,
    message = 'Success',
  ) {
    return res.status(StatusCodes.OK).json({
      success: true,
      message,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
