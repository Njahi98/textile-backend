import { NextFunction, Request, Response } from 'express';
import { prisma } from '../server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { RegisterRequest, LoginRequest, emailResetRequest, PasswordResetRequest } from '../utils/validation';
import { sendEmail } from '../utils/email';
import { AuthenticatedRequest, passwordResetJwtPayload } from '../types';
import crypto from 'crypto';
import { createUserSession, validateUserSession, revokeUserSession, revokeAllUserSessions } from '../utils/sessionManager';
import { OAuth2Client } from 'google-auth-library';
import AuditService from '../utils/auditService';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_TOKEN_EXPIRES_IN = '15m'; 
const REFRESH_TOKEN_EXPIRES_IN = '7d'; 
const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000; 
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
);

// Generate token pair and store refresh token
const generateTokenPair = async (userId: number, req: Request) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh', jti: crypto.randomUUID() },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );

  await createUserSession(userId, refreshToken, req);
  return { accessToken, refreshToken };
};

// Set authentication cookies
const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  } as const;

  res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: ACCESS_COOKIE_MAX_AGE });
  res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: REFRESH_COOKIE_MAX_AGE });
};

// Clear authentication cookies
const clearAuthCookies = (res: Response) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  } as const;

  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
};

// Standard error response
const errorResponse = (res: Response, status: number, error: string, message: string) => {
  res.status(status).json({ error, message });
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, username }: RegisterRequest = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      errorResponse(res, 409, 'UserExists', req.t('auth:errors.userExists'));
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, username, password: hashedPassword },
      select: { id: true, email: true, username: true, role: true, createdAt: true },
    });

    const { accessToken, refreshToken } = await generateTokenPair(user.id, req);
    setAuthCookies(res, accessToken, refreshToken);

    res.status(201).json({
      success: true,
      message: req.t('auth:success.registered'),
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password }: LoginRequest = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        password: true,
        role: true,
        status: true,
        avatarUrl: true,
      },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      errorResponse(res, 401, 'InvalidCredentials', req.t('auth:errors.invalidCredentials'));
      return;
    }

    if (user.status !== 'active') {
      errorResponse(
        res, 
        403, 
        'AccountInactive', 
        req.t('auth:errors.accountInactive', { status: user.status }) ?? 
        `Your account is currently ${user.status} and cannot be accessed`
      );
      return;
    }

    const { accessToken, refreshToken } = await generateTokenPair(user.id, req);
    setAuthCookies(res, accessToken, refreshToken);

    await AuditService.logAuth('LOGIN', user.id, req, {
      loginMethod: 'email',
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      message: req.t('auth:success.loginSuccessful') ?? 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        avatarUrl: user.avatarUrl
      },
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      errorResponse(res, 401, 'NoRefreshToken', req.t('auth:errors.noRefreshToken') ?? 'Refresh token is required');
      return;
    }

    const sessionData = await validateUserSession(refreshToken);
    if (!sessionData) {
      clearAuthCookies(res);
      errorResponse(res, 401, 'InvalidRefreshToken', req.t('auth:errors.invalidRefreshToken') ?? 'Invalid or expired refresh token');
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    } catch (jwtError) {
      await revokeUserSession(refreshToken);
      clearAuthCookies(res);
      errorResponse(res, 401, 'InvalidRefreshToken', req.t('auth:errors.invalidRefreshToken') ?? 'Invalid or expired refresh token');
      return;
    }

    if (decoded.type !== 'refresh') {
      await revokeUserSession(refreshToken);
      clearAuthCookies(res);
      errorResponse(res, 401, 'InvalidTokenType', req.t('auth:errors.invalidTokenType') ?? 'Invalid token type');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, username: true, role: true, status: true },
    });

    if (!user || user.status !== 'active') {
      await revokeUserSession(refreshToken);
      clearAuthCookies(res);
      errorResponse(res, 401, 'UserNotFound', req.t('auth:errors.userNotFound') ?? 'User account no longer exists or has been deactivated');
      return;
    }

    await revokeUserSession(refreshToken);
    const { accessToken, refreshToken: newRefreshToken } = await generateTokenPair(user.id, req);
    setAuthCookies(res, accessToken, newRefreshToken);

    res.json({
      success: true,
      message: req.t('auth:success.tokensRefreshed') ?? 'Tokens refreshed successfully',
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      errorResponse(res, 400, 'No active session', req.t('auth:errors.noActiveSession') ?? 'You are not logged in or your session has expired');
      return;
    }

    const sessionData = await validateUserSession(refreshToken);
    const userId = sessionData?.userId;

    await revokeUserSession(refreshToken);
    clearAuthCookies(res);

    if (userId) {
      await AuditService.logAuth('LOGOUT', userId, req, {
        logoutMethod: 'manual',
        userAgent: req.get('User-Agent'),
      });
    }
    
    res.status(200).json({ 
      success: true,
      message: req.t('auth:success.loggedOut') ?? 'Logged out successfully'
    });
  } catch (error) {
    clearAuthCookies(res);
    res.status(200).json({ 
      success: true,
      message: req.t('auth:success.loggedOut') ?? 'Logged out successfully'
    });
  }
};

export const requestPasswordReset = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email }: emailResetRequest = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    // Always return success to prevent email enumeration
    const successMessage = req.t('auth:success.passwordResetSent') ?? 
      'If an account exists with this email, you will receive a password reset link';

    if (!user) {
      res.status(200).json({ success: true, message: successMessage });
      return;
    }

    const resetToken = jwt.sign(
      { userId: user.id, purpose: 'password-reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    const resetLink = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;
    
    await sendEmail({
      to: email,
      subject: req.t('emails:passwordReset.subject') ?? 'Password Reset Request',
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${req.t('emails:passwordReset.subject') ?? 'Password Reset Request'}</h2>
        <p>${req.t('emails:passwordReset.greeting') ?? 'Hello,'}</p>
        <p>${req.t('emails:passwordReset.intro') ?? "We received a request to reset your password. If you didn't make this request, you can safely ignore this email."}</p>
        <p>${req.t('emails:passwordReset.instruction') ?? 'To reset your password, click the link below (valid for 1 hour):'}</p>
        <p>
        <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
          ${req.t('emails:passwordReset.buttonText') ?? 'Reset Password'}
        </a>
        </p>
        <p>${req.t('emails:passwordReset.fallback') ?? "If the button doesn't work, copy and paste this link into your browser:"}</p>
        <p>${resetLink}</p>
        <p>${req.t('emails:passwordReset.security') ?? 'For security reasons, this link will expire in 1 hour.'}</p>
        <p>${req.t('emails:passwordReset.signature') ?? 'Best regards,<br>Your Application Team'}</p>
      </div>
      `
    });

    res.status(200).json({ success: true, message: successMessage });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, password }: PasswordResetRequest = req.body;

    const decoded = jwt.verify(token, JWT_SECRET) as passwordResetJwtPayload;
    
    if (decoded.purpose !== 'password-reset') {
      errorResponse(res, 400, 'Invalid token', req.t('auth:errors.invalidResetToken') ?? 'Invalid reset token');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true }
    });

    if (!user) {
      errorResponse(res, 400, 'Invalid token', req.t('auth:errors.invalidResetToken') ?? 'Invalid reset token');
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    await revokeAllUserSessions(user.id);

    res.status(200).json({
      success: true,
      message: req.t('auth:success.passwordReset') ?? 'Password reset successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      errorResponse(res, 401, 'Unauthorized', req.t('auth:errors.unauthorized') ?? 'User not authenticated');
      return;
    }

    res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};

export const googleLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { credential } = req.body;

    if (!credential) {
      errorResponse(res, 400, 'Missing credential', req.t('auth:errors.missingCredential') ?? 'Google credential is required');
      return;
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID!,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      errorResponse(res, 400, 'Invalid token', req.t('auth:errors.invalidToken') ?? 'Invalid Google credential');
      return;
    }

    const { sub: googleId, email, name, picture, given_name, family_name } = payload;

    if (!email) {
      errorResponse(res, 400, 'Email required', req.t('auth:errors.emailRequired') ?? 'Email is required from Google account');
      return;
    }

    let user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
        avatarUrl: true,
        googleId: true,
      },
    });

    if (user) {
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId },
          select: {
            id: true,
            email: true,
            username: true,
            role: true,
            status: true,
            avatarUrl: true,
            googleId: true,
          },
        });
      }

      if (user.status !== 'active') {
        errorResponse(
          res, 
          403, 
          'AccountInactive', 
          req.t('auth:errors.accountInactive', { status: user.status }) ?? 
          `Your account is currently ${user.status} and cannot be accessed`
        );
        return;
      }
    } else {
      const username = email.split('@')[0] + '_' + Date.now().toString().slice(-4);
      
      user = await prisma.user.create({
        data: {
          email,
          username,
          firstName: given_name ?? name?.split(' ')[0] ?? null,
          lastName: family_name ?? name?.split(' ').slice(1).join(' ') ?? null,
          avatarUrl: picture ?? null,
          googleId,
          password: '',
        },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          status: true,
          avatarUrl: true,
          googleId: true,
        },
      });
    }

    const { accessToken, refreshToken } = await generateTokenPair(user.id, req);
    setAuthCookies(res, accessToken, refreshToken);

    await AuditService.logAuth('LOGIN', user.id, req, {
      loginMethod: 'google',
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      message: req.t('auth:success.googleLoginSuccessful') ?? 'Google login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        avatarUrl: user.avatarUrl
      },
    });
  } catch (error) {
    console.error('Google login error:', error);
    next(error);
  }
};