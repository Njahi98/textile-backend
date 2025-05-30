import { NextFunction, Request, Response } from 'express';
import { prisma } from '../server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { RegisterRequest, LoginRequest } from '../utils/validation';
import { CustomError } from '@/middleware/errorHandler';

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

    const hashedPassword = await bcrypt.hash(password, 12);

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
      { userId: user.id, email: user.email, role: user.role },
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
      { userId: user.id, email: user.email, role: user.role },
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