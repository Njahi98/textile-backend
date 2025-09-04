import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from './generated/prisma';
import { errorHandler } from './middleware/errorHandler';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { apiLimiter, authLimiter } from './middleware/rateLimiter';
import SocketService from './utils/socketService';

import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import userRoutes from './routes/user';
import workerRoutes from './routes/worker';
import productionLineRoutes from './routes/productionLine';
import assignmentRoutes from './routes/assignment';
import productRoutes from './routes/product';
import performanceRecordRoutes from './routes/performanceRecord';
import accountRoutes from './routes/account';
import chatRoutes from './routes/chat';

dotenv.config();

const app = express();
const server = createServer(app);
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});

const socketService = new SocketService(io);

declare global {
  var socketService: SocketService;
}
global.socketService = socketService;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

if (process.env.NODE_ENV === 'production') {
  app.use(apiLimiter);
}

app.use(morgan('dev'));

app.use('/api/auth',
  process.env.NODE_ENV === 'production' ? authLimiter : [],
  authRoutes
);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/production-lines', productionLineRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/products', productRoutes);
app.use('/api/performance', performanceRecordRoutes);
app.use('/api/settings/account', accountRoutes);
app.use('/api/chat', chatRoutes); 

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      websocket: 'connected',
      onlineUsers: socketService.getOnlineUsers().length
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist`,
  });
});

app.use(errorHandler);

const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Shutting down...`);
  
  try {
    await prisma.$disconnect();
    io.close();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('Shutdown error:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server ready on port ${PORT}`);
});

export { prisma, socketService };