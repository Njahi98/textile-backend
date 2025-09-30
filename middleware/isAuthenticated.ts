import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, JwtPayload } from '../types';
import jwt from 'jsonwebtoken';
import { prisma } from '../server';
import { Role } from '../generated/prisma';

const JWT_SECRET = process.env.JWT_SECRET!;

const authorizeRole = (roles: Role | Role[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: req.t('errors:server.unauthorized') ?? 'Please log in to access this resource',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: req.t('errors:server.forbidden', { roles: allowedRoles.join(' or ') }) ?? `This action requires ${allowedRoles.join(' or ')} privileges`,
      });
      return;
    }

    next();
  };
};

const clearAuthCookies = (res: Response) => {
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
};

export const isAuthenticated = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const accessToken = req.cookies.accessToken;

  if (!accessToken) {
    res.status(401).json({
      error: 'NoAccessToken',
      message: req.t('errors:server.unauthorized') ?? 'Please log in to access this resource',
    });
    return;
  }

  try {
    const decoded = jwt.verify(accessToken, JWT_SECRET) as JwtPayload & { type: string };
    
    if (decoded.type !== 'access') {
      clearAuthCookies(res);
      res.status(401).json({
        error: 'InvalidTokenType',
        message: req.t('errors:server.unauthorized') ?? 'Please log in to access this resource',
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
        status: true,
        avatarPublicId: true,
        avatarUrl: true,
      },
    });

    if (!user || user.status !== 'active') {
      clearAuthCookies(res);
      res.status(401).json({
        error: 'UserNotFound',
        message: req.t('auth:errors.userNotFound') ?? 'User account no longer exists or has been deactivated',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    // Token invalid or expired - return 401 so frontend can refresh
    res.status(401).json({
      error: 'InvalidToken',
      message: req.t('errors:server.unauthorized') ?? 'Please log in to access this resource',
    });
  }
};

// Special middleware for socket authentication (doesn't attempt refresh)
export const isAuthenticatedSocket = async (token: string): Promise<{ userId: number; user: any } | null> => {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & { type: string };
    
    if (decoded.type !== 'access') {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!user || user.status !== 'active') {
      return null;
    }

    return { userId: user.id, user };
  } catch (error) {
    return null;
  }
};

// Role-based exports
export const requireAdmin = authorizeRole('ADMIN');
export const requireSuperAdmin = authorizeRole('SUPERADMIN');
export const requireUser = authorizeRole('USER');
export const requireAdminOrSuperAdmin = authorizeRole(['ADMIN', 'SUPERADMIN']);