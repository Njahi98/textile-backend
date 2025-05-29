import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from './generated/prisma';
import authRoutes from './routes/auth';
import { errorHandler } from './middleware/errorHandler';
import cookieParser from 'cookie-parser';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    // It allows cookies (like a JWT) to be sent with the request,
    // Without this, frontend won’t be able to send or receive cookies, which breaks login/logout
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

//Routes
app.use('/api/auth', authRoutes);


// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist`,
  });
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
// Listen to SIGINT or "signal interrupt" to gracefully shut down the server
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  // Close the Prisma client connection and prevent database connection leaks
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});

export { prisma };
