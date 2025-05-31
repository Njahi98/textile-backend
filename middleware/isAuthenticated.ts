import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, JwtPayload } from '../types';
import jwt from 'jsonwebtoken';
import { prisma } from 'server';
import { CustomError } from './errorHandler';
export const isAuthenticated = async (req: AuthenticatedRequest,res: Response,next: NextFunction) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      res.status(401).json({ error: 'Authentication required',message: 'Please log in to access this resource' });
      return;
    }
    if (!process.env.JWT_SECRET) {
      const error = new Error('JWT_SECRET is not configured') as CustomError;
      error.statusCode = 500;
      error.message = 'Internal server configuration error';
      throw error;
    }
    const decoded = jwt.verify(token,process.env.JWT_SECRET) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });
    if (!user) {
      res.status(401).json({ error: 'User not found',message: 'User account no longer exists or has been deactivated' });
      return;
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};


export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
      if (!req.user) {
    res.status(401).json({ error: 'Authentication required',message: 'Please log in to access this resource' });
    return;
  }
  
  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin access required',message: 'You do not have permission to access this resource' });
    return;
  }
  next();

  } catch (error) {
   next(error); 
  }
};
