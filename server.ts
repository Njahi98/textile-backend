import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from './generated/prisma';
import { errorHandler } from './middleware/errorHandler';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { apiLimiter, authLimiter } from './middleware/rateLimiter';

import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import workerRoutes from './routes/worker';
import productionLineRoutes from './routes/productionLine';
import assignmentRoutes from './routes/assignment';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Apply rate limiting only in production
if (process.env.NODE_ENV === 'production') {
  app.use(apiLimiter);
}

app.use(morgan('dev'));

//Routes
app.use('/api/auth',
  process.env.NODE_ENV === 'production' ? authLimiter : [],
  authRoutes);
app.use('/api/users',userRoutes);
app.use('/api/workers',workerRoutes);
app.use('/api/production-lines', productionLineRoutes);
app.use('/api/assignments', assignmentRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist`,
  });
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});

export { prisma };
