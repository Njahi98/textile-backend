import { Request } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

// Extend Express Request type to include validated body types
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}