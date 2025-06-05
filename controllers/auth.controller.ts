import { NextFunction, Request, Response } from 'express';
import { prisma } from '../server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { RegisterRequest, LoginRequest, emailResetRequest, PasswordResetRequest } from '../utils/validation';
import { CustomError } from '@/middleware/errorHandler';
import { sendEmail } from '@/utils/email';
import { AuthenticatedRequest, passwordResetJwtPayload } from '../types';

if (!process.env.JWT_SECRET) {
  const error = new Error('JWT_SECRET is not configured') as CustomError;
  error.statusCode = 500;
  error.message = 'Internal server configuration error';
  throw error;
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, name }: RegisterRequest = req.body;

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
        name,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: COOKIE_MAX_AGE,
    });

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
        name: true,
        password: true,
        role: true,
        createdAt: true,
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

    const token = jwt.sign(
      { userId: user.id},
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: COOKIE_MAX_AGE,
    });

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = (req: Request, res: Response): void => {
  // no need to try/catch (cookie operations don't throw)
    const token = req.cookies.token;
  if(!token) {
    res.status(400).json({
      error: 'No active session',
      message: 'You are not logged in or your session has expired'
    });
    return;
  }
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/', // Explicitly clear from all paths
  });
  res.status(200).json({ 
    success: true,
    message: 'Logged out successfully' 
  });
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

    const token = jwt.sign(
      //Added a purpose field to the JWT to prevent token reuse
      { userId: user.id, purpose: 'password-reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    
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
