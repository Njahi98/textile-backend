import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export const generateCsrfToken = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.cookies['XSRF-TOKEN']) {
    const token = crypto.randomBytes(32).toString('hex');
    
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
  
  next();
};

export const verifyCsrfToken = (req: Request, res: Response, next: NextFunction): void => {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  // Skip CSRF for public auth endpoints
  const publicAuthPaths = [
    '/auth/login',
    '/auth/register',
    '/auth/password-reset-request',
    '/auth/password-reset',
    '/auth/google-login',
    '/auth/refresh', // refresh endpoint should not require CSRF
  ];

  if (publicAuthPaths.some(path => req.path.includes(path))) {
    next();
    return;
  }

  const tokenFromCookie = req.cookies['XSRF-TOKEN'];
  const tokenFromHeader = req.headers['x-xsrf-token'] as string || req.headers['x-csrf-token'] as string;

  if (!tokenFromCookie || !tokenFromHeader || tokenFromCookie !== tokenFromHeader) {
    res.status(403).json({
      error: 'CSRF_TOKEN_INVALID',
      message: req.t('errors:csrf.invalid') ?? 'Invalid or missing CSRF token',
    });
    return;
  }

  next();
};