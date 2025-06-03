import { Request, Response, NextFunction } from 'express';

interface LoggedRequest extends Request {
  startTime?: number;
}

export const requestLogger = (req: LoggedRequest, res: Response, next: NextFunction) => {
  req.startTime = Date.now();
  
  // Log request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - IP: ${req.ip}`);
  
  // Log response when finished
  res.on('finish', () => {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.url} - ` +
      `${res.statusCode} - ${duration}ms`
    );
  });
  
  next();
};


