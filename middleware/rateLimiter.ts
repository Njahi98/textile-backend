import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from 'express';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per windowMs
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
  max: 8, // 8 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

export const imageUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 requests per windowMs
  message: {
    error: 'Too many image upload attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Custom RateLimiter class for AI insights
class RateLimiter {
  private requests: Map<string, number> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 30 * 60 * 1000, maxRequests: number = 1) { // 30 minutes, 1 request
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isAllowed(key: string): { allowed: boolean; resetTime?: number; remainingTime?: number } {
    const now = Date.now();
    const lastRequest = this.requests.get(key);

    if (!lastRequest) {
      this.requests.set(key, now);
      return { allowed: true };
    }

    const timeSinceLastRequest = now - lastRequest;
    
    if (timeSinceLastRequest >= this.windowMs) {
      this.requests.set(key, now);
      return { allowed: true };
    }

    const remainingTime = this.windowMs - timeSinceLastRequest;
    const resetTime = lastRequest + this.windowMs;
    
    return { 
      allowed: false, 
      resetTime,
      remainingTime: Math.ceil(remainingTime / 1000) // Return in seconds
    };
  }

  // Clean up old entries periodically
  cleanup() {
    const now = Date.now();
    for (const [key, timestamp] of this.requests.entries()) {
      if (now - timestamp > this.windowMs) {
        this.requests.delete(key);
      }
    }
  }
}

// Global rate limiter instance for AI insights
const aiInsightsRateLimiter = new RateLimiter(30 * 60 * 1000, 1); // 30 minutes, 1 request

// Clean up old entries every 5 minutes
setInterval(() => {
  aiInsightsRateLimiter.cleanup();
}, 5 * 60 * 1000);

// Middleware for AI insights rate limiting
export const aiInsightsRateLimit = (req: Request, res: Response, next: NextFunction) => {
  // Use user ID as the rate limit key, or IP if no user
  const key = (req as any).user?.id || req.ip || 'anonymous';
  
  const result = aiInsightsRateLimiter.isAllowed(key);
  
  if (!result.allowed) {
    return res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'AI insights can only be generated once every 30 minutes',
      resetTime: result.resetTime,
      remainingTime: result.remainingTime
    });
  }
  
  next();
};