import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, JwtPayload } from '../types';
import jwt from 'jsonwebtoken';
import { prisma } from '../server';
import { Role } from 'generated/prisma';
import { validateUserSession, revokeUserSession } from '../utils/sessionManager';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

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

// Helper function to attempt token refresh
const attemptTokenRefresh = async (refreshToken: string, res: Response): Promise<{ user: any; newAccessToken: string } | null> => {
  try {
    // Validate refresh token in database first
    const sessionData = await validateUserSession(refreshToken);
    if (!sessionData) {
      return null;
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    
    if (decoded.type !== 'refresh') {
      // Revoke invalid session
      await revokeUserSession(refreshToken);
      return null;
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
      // Revoke session for inactive user
      await revokeUserSession(refreshToken);
      return null;
    }

    const newAccessToken = jwt.sign(
      { userId: user.id, type: 'access' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000,
    });

    return { user, newAccessToken };
  } catch (error) {
    // Revoke invalid session on JWT error
    await revokeUserSession(refreshToken);
    return null;
  }
};

export const isAuthenticated = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;

  // Try access token first
  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, JWT_SECRET) as JwtPayload & { type: string };
      
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
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
        res.status(401).json({
          error: 'UserNotFound',
          message: 'User account no longer exists or has been deactivated',
        });
        return;
      }

      req.user = user;
      return next();
    } catch (jwtError) {
      // Access token is invalid/expired, try refresh token
    }
  }

  // Try refresh token if access token failed
  if (refreshToken) {
    const refreshResult = await attemptTokenRefresh(refreshToken, res);
    
    if (refreshResult) {
      req.user = refreshResult.user;
      return next();
    }
  }

  // Both tokens failed - clear cookies
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

  res.status(401).json({
    error: 'NoValidToken',
    message: 'Please log in to access this resource',
  });
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
export const requireUser = authorizeRole('USER');