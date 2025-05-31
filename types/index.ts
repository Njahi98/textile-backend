import { Request } from "express";
import { Role } from "generated/prisma";

export interface JwtPayload {
  userId: number;
  email: string;
  role: Role;
}

export interface passwordResetJwtPayload{
  userId:number
}


export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    name: string;
    role: Role;
  };
}


