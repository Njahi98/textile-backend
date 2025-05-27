import { NextFunction, Request, Response } from 'express';
import { prisma } from '../server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
  LoginRequest,
  loginSchema,
  RegisterRequest,
  registerSchema,
} from '../utils/validation';

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validatedData = registerSchema.parse(req.body) as RegisterRequest;
    //check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        email: validatedData.email,
        name: validatedData.name,
      },
    });
    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }
    //hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        name: validatedData.name,
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

    //generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '15m' }
    );

    //set Http Only Cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });
    res.status(201).json({
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
) => {
  try {
    const validatedData = loginSchema.parse(req.body) as LoginRequest;
    //find user by email
    const user = await prisma.user.findUnique({
      where: {
        email: validatedData.email,
      },
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
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    // Check password
    const isValidPassword = await bcrypt.compare(
      validatedData.password,
      user.password
    );
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '15m' }
    );
    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });
    res.json({
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

export const logout = (req: Request, res: Response) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
};
