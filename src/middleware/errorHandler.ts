import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/AppError';
import { env } from '../config/env';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.isOperational && (err as any).details ? { details: (err as any).details } : {}),
      },
    });
    return;
  }

  // Handle Mongo duplicate key error if not caught earlier
  if ((err as any).code === 11000) {
    res.status(409).json({
      error: {
        code: 'DUPLICATE_KEY_CONFLICT',
        message: 'A place record with identical unique constraints already exists',
        keyPattern: (err as any).keyPattern,
      },
    });
    return;
  }

  console.error('Unhandled error in India Place API:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'development' ? err.message : 'An internal error occurred',
    },
  });
}
