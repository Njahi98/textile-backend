import { Request, Response, NextFunction } from 'express';
import { Prisma } from '../generated/prisma';

export interface CustomError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error:', error);

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        res.status(409).json({
          error: 'Unique constraint violation',
          message: req.t('errors:database.uniqueConstraint') ?? 'A record with this information already exists',
        });
        return;
      case 'P2025':
        res.status(404).json({
          error: 'Record not found',
          message: req.t('errors:database.recordNotFound') ?? 'The requested resource was not found',
        });
        return;
      case 'P2003':
        res.status(400).json({
          error: 'Foreign key constraint violation',
          message: req.t('errors:database.foreignKeyConstraint') ?? 'Invalid reference to related resource',
        });
        return;
      default:
        res.status(500).json({
          error: 'Database error',
          message: req.t('errors:database.general') ?? 'An error occurred while processing your request',
        });
        return;
    }
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: 'Invalid token',
      message: req.t('errors:auth.invalidToken') ?? 'Please log in again',
    });
    return;
  }

  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      error: 'Token expired',
      message: req.t('errors:auth.tokenExpired') ?? 'Your session has expired. Please log in again',
    });
    return;
  }

  // Custom status code errors
  if (error.statusCode) {
    res.status(error.statusCode).json({
      error: error.message || 'An error occurred',
      message: error.message,
    });
    return;
  }

  // Default server error
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' 
      ? req.t('errors:server.production') ?? 'Something went wrong on our end'
      : error.message,
  });
};