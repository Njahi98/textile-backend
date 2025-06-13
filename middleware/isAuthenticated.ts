import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, JwtPayload } from '../types';
import jwt from 'jsonwebtoken';
import { prisma } from 'server';
import { CustomError } from './errorHandler';
import { Role } from "generated/prisma";

// Role-based authorization helper
const authorizeRole = (role: Role) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        const error = new Error('UNAUTHORIZED') as CustomError;
        error.statusCode = 401;
        error.message = 'Please log in to access this resource';
        throw error;
      }

      if (req.user.role !== role) {
        const error = new Error('FORBIDDEN') as CustomError;
        error.statusCode = 403;
        error.message = `This action requires ${role} privileges`;
        throw error;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
export const isAuthenticated = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      const error = new Error('NO_TOKEN') as CustomError;
      error.statusCode = 401;
      error.message = 'Please log in to access this resource';
      throw error;
    }

    if (!process.env.JWT_SECRET) {
      const error = new Error('JWT_SECRET_MISSING') as CustomError;
      error.statusCode = 500;
      error.message = 'Internal server configuration error';
      throw error;
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
    } catch (jwtError) {
      const error = new Error('INVALID_TOKEN') as CustomError;
      error.statusCode = 401;
      error.message = 'Your session has expired or is invalid';
      throw error;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      const error = new Error('USER_NOT_FOUND') as CustomError;
      error.statusCode = 401;
      error.message = 'User account no longer exists or has been deactivated';
      throw error;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};


// Role-based middleware exports
export const requireAdmin = authorizeRole('ADMIN');
export const requireUser = authorizeRole('USER');
