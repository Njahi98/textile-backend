import { Request } from "express";
import { Role } from "../generated/prisma";

export interface JwtPayload {
  userId: number;
  email: string;
  role: Role;
}

export interface passwordResetJwtPayload {
  userId: number;
  purpose: 'password-reset';
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    username: string;
    role: Role;
  };
  file?: Express.Multer.File;
}

// Global Express type augmentation
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        username: string;
        role: Role;
      };
      file?: Multer.File;
    }
    
    namespace Multer {
      interface File {
        buffer: Buffer;
        originalname: string;
        mimetype: string;
        size: number;
        fieldname: string;
        encoding: string;
      }
    }
  }
}