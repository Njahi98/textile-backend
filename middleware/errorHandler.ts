import { Request, Response, NextFunction } from 'express';
import { Prisma } from '../generated/prisma';

interface CustomError extends Error {
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
          message: 'A record with this information already exists',
        });
        return;
      case 'P2025':
        res.status(404).json({
          error: 'Record not found',
          message: 'The requested resource was not found',
        });
        return;
      case 'P2003':
        res.status(400).json({
          error: 'Foreign key constraint violation',
          message: 'Invalid reference to related resource',
        });
        return;
      default:
        res.status(500).json({
          error: 'Database error',
          message: 'An error occurred while processing your request',
        });
        return;
    }
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: 'Invalid token',
      message: 'Please log in again',
    });
    return;
  }

  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      error: 'Token expired',
      message: 'Your session has expired. Please log in again',
    });
    return;
  }

  // Custom status code errors
  if (error.statusCode) {
    res.status(error.statusCode).json({
      error: error.message || 'An error occurred',
    });
    return;
  }

  // Default server error
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong on our end' 
      : error.message,
  });
};