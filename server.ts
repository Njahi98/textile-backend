import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParse from 'cookie-parser';
import { PrismaClient } from './generated/prisma';
import authRoutes from './routes/auth';
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
app.use(cookieParse());

//Routes
app.use('/api/auth', authRoutes);


// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
// app.use(errorHandler);

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
