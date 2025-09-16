import { NextFunction, Request, Response } from 'express';
import { prisma } from '../server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { RegisterRequest, LoginRequest, emailResetRequest, PasswordResetRequest } from '../utils/validation';
import { CustomError } from '@/middleware/errorHandler';
import { sendEmail } from '@/utils/email';
import { AuthenticatedRequest, passwordResetJwtPayload } from '../types';
import crypto from 'crypto';
import { 
  createUserSession, 
  validateUserSession, 
  revokeUserSession, 
  revokeAllUserSessions,
  cleanupExpiredSessions 
} from '../utils/sessionManager';
import { OAuth2Client } from 'google-auth-library';


if (!process.env.JWT_SECRET) {
  const error = new Error('JWT_SECRET is not configured') as CustomError;
  error.statusCode = 500;
  error.message = 'Internal server configuration error';
  throw error;
}

if (!process.env.JWT_REFRESH_SECRET) {
  const error = new Error('JWT_REFRESH_SECRET is not configured') as CustomError;
  error.statusCode = 500;
  error.message = 'Internal server configuration error';
  throw error;
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TOKEN_EXPIRES_IN = '15m'; 
const REFRESH_TOKEN_EXPIRES_IN = '7d'; 
const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000; 
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
);

// Helper function to generate token pair and store refresh token in database
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

  // Store refresh token in database
  await createUserSession(userId, refreshToken, req);

  return { accessToken, refreshToken };
};

// Helper function to set auth cookies
const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
};

// Helper function to clear auth cookies
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

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, username }: RegisterRequest = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      res.status(409).json({ 
        error: 'User already exists',
        message: 'An account with this email already exists'
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    const { accessToken, refreshToken } = await generateTokenPair(user.id, req);
    setAuthCookies(res, accessToken, refreshToken);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
        avatarUrl:true,
      },
    });

    if (!user) {
      res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({
        error: 'AccountInactive',
        message: 'Your account is currently ' + user.status + ' and cannot be accessed.'
      });
      return;
    }

    const { accessToken, refreshToken } = await generateTokenPair(user.id, req);
    setAuthCookies(res, accessToken, refreshToken);

    res.json({
      success: true,
      message: 'Login successful',
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

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      res.status(401).json({
        error: 'NoRefreshToken',
        message: 'Refresh token is required',
      });
      return;
    }

    // Validate refresh token in database
    const sessionData = await validateUserSession(refreshToken);
    if (!sessionData) {
      clearAuthCookies(res);
      res.status(401).json({
        error: 'InvalidRefreshToken',
        message: 'Invalid or expired refresh token',
      });
      return;
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    } catch (jwtError) {
      // Revoke invalid session from database
      await revokeUserSession(refreshToken);
      clearAuthCookies(res);
      res.status(401).json({
        error: 'InvalidRefreshToken',
        message: 'Invalid or expired refresh token',
      });
      return;
    }

    // Verify token type
    if (decoded.type !== 'refresh') {
      await revokeUserSession(refreshToken);
      clearAuthCookies(res);
      res.status(401).json({
        error: 'InvalidTokenType',
        message: 'Invalid token type',
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
      },
    });

    if (!user || user.status !== 'active') {
      await revokeUserSession(refreshToken);
      clearAuthCookies(res);
      res.status(401).json({
        error: 'UserNotFound',
        message: 'User account no longer exists or has been deactivated',
      });
      return;
    }

    // Revoke old refresh token and generate new token pair (token rotation)
    await revokeUserSession(refreshToken);
    const { accessToken, refreshToken: newRefreshToken } = await generateTokenPair(user.id, req);
    setAuthCookies(res, accessToken, newRefreshToken);

    res.json({
      success: true,
      message: 'Tokens refreshed successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      res.status(400).json({
        error: 'No active session',
        message: 'You are not logged in or your session has expired'
      });
      return;
    }

    // Revoke the session from database
    await revokeUserSession(refreshToken);
    clearAuthCookies(res);
    
    res.status(200).json({ 
      success: true,
      message: 'Logged out successfully' 
    });
  } catch (error) {
    // Even if revoking fails, clear cookies
    clearAuthCookies(res);
    res.status(200).json({ 
      success: true,
      message: 'Logged out successfully' 
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
    if (!user) {
      res.status(200).json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link'
      });
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
      subject: 'Password Reset Request',
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hello,</p>
        <p>We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
        <p>To reset your password, click the link below (valid for 1 hour):</p>
        <p>
        <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
          Reset Password
        </a>
        </p>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p>${resetLink}</p>
        <p>For security reasons, this link will expire in 1 hour.</p>
        <p>Best regards,<br>Your Application Team</p>
      </div>
      `
    });

    res.status(200).json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link'
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, password }: PasswordResetRequest = req.body;

    const decoded = jwt.verify(token, JWT_SECRET) as passwordResetJwtPayload;
    
    if (decoded.purpose !== 'password-reset') {
      res.status(400).json({
        error: 'Invalid token',
        message: 'Invalid reset token'
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true }
    });

    if (!user) {
      res.status(400).json({
        error: 'Invalid token',
        message: 'Invalid reset token'
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    // Revoke all sessions for security after password reset
    await revokeAllUserSessions(user.id);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
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

export const googleLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { credential, clientId } = req.body;

    if (!credential) {
      res.status(400).json({
        error: 'Missing credential',
        message: 'Google credential is required'
      });
      return;
    }

    // Verify the Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      res.status(400).json({
        error: 'Invalid token',
        message: 'Invalid Google credential'
      });
      return;
    }

    const { sub: googleId, email, name, picture, given_name, family_name } = payload;

    if (!email) {
      res.status(400).json({
        error: 'Email required',
        message: 'Email is required from Google account'
      });
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
      // User exists - check if they have Google ID linked
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
        res.status(403).json({
          error: 'AccountInactive',
          message: 'Your account is currently ' + user.status + ' and cannot be accessed.'
        });
        return;
      }
    } else {
      // Create new user from Google account
      const username = email.split('@')[0] + '_' + Date.now().toString().slice(-4);
      
      user = await prisma.user.create({
        data: {
          email,
          username,
          firstName: given_name || name?.split(' ')[0],
          lastName: family_name || name?.split(' ').slice(1).join(' '),
          avatarUrl: picture,
          googleId,
          password: '', // Empty password for Google users
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

    // Generate tokens
    const { accessToken, refreshToken } = await generateTokenPair(user.id, req);
    setAuthCookies(res, accessToken, refreshToken);

    res.json({
      success: true,
      message: 'Google login successful',
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
