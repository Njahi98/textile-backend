import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from "../types";

// Minimal client IP resolver for rate limiting (parses X-Forwarded-For safely)
function getClientIp(req: Request): string {
  const xff = req.get('X-Forwarded-For');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const xReal = req.get('X-Real-IP');
  if (xReal) return xReal;
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests
message: (req: Request) => ({
    error: req.t('errors:rateLimit.general') ?? 'Too many requests from this IP, please try again later.',
  }),
  standardHeaders: true,
  legacyHeaders: false,
  // Ensure consistent IP when behind proxy
  keyGenerator: (req: Request) => getClientIp(req),
  // Skip health check
  skip: (req) => {
    return req.url === '/api/health';
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8, // 8 requests
  message: (req: Request) => ({
    error: req.t('errors:rateLimit.auth') ?? 'Too many authentication attempts, please try again later.',
  }),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => getClientIp(req),
  skipSuccessfulRequests: true,
});

export const imageUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 requests
  message: (req: Request) => ({
    error: req.t('errors:rateLimit.imageUpload') ?? 'Too many image upload attempts, please try again later.',
  }),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => getClientIp(req),
});

export const aiInsightsRateLimit = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 1, // 1 request
message: (req: AuthenticatedRequest) => ({
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: req.t('errors:rateLimit.aiInsights') ?? 'AI insights can only be generated once every 30 minutes',
  }),
  standardHeaders: true,
  legacyHeaders: false,
keyGenerator: (req: AuthenticatedRequest) => req.user?.id?.toString() || getClientIp(req) || 'anonymous',});