import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from "../types";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip health check
  skip: (req) => {
    return req.url === '/api/health';
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8, // 8 requests
  message: {
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

export const imageUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 requests
  message: {
    error: 'Too many image upload attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const aiInsightsRateLimit = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 1, // 1 request
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'AI insights can only be generated once every 30 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
keyGenerator: (req: AuthenticatedRequest) => req.user?.id?.toString() || req.ip || 'anonymous',});