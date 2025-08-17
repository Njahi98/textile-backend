import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, JwtPayload } from '../types';
import jwt from 'jsonwebtoken';
import { prisma } from 'server';
import { Role } from 'generated/prisma';

const authorizeRole = (role: Role) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Please log in to access this resource',
      });
      return;
    }

    if (req.user.role !== role) {
       res.status(403).json({
        error: 'Forbidden',
        message: `This action requires ${role} privileges`,
      });
      return;
    }

    next();
  };
};

export const isAuthenticated = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies.token;

  if (!token) {
     res.status(401).json({
      error: 'NoToken',
      message: 'Please log in to access this resource',
    });
    return;
  }

  if (!process.env.JWT_SECRET) {
     res.status(500).json({
      error: 'ServerConfig',
      message: 'Internal server configuration error',
    });
    return;
  }

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
  } catch (jwtError) {
     res.status(401).json({
      error: 'InvalidToken',
      message: 'Your session has expired or is invalid',
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      firstName:true,
      lastName:true,
      status:true,
      phone:true
    },
  });

  if (!user) {
     res.status(401).json({
      error: 'UserNotFound',
      message: 'User account no longer exists or has been deactivated',
    });
    return;
  }

  req.user = user;
  next();
};

// Role-based exports
export const requireAdmin = authorizeRole('ADMIN');
export const requireUser = authorizeRole('USER');
