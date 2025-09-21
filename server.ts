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
import { cleanupExpiredSessions } from './utils/sessionManager';
import compression from 'compression';
import helmet from 'helmet';

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
import insightsRoutes from './routes/insights';
import auditRoutes from './routes/audit';
import { auditLogger } from './middleware/auditMiddleware';

dotenv.config();

if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL environment variable is required in production');
}

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

if (process.env.NODE_ENV === 'production') {
  app.use(compression({
    filter: (req, res) => {
      if (req.path.startsWith('/api/auth')) {
        return false;
      }
      return compression.filter(req, res);
    },
  }));

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // Allow WebSocket connections and frontend API calls
        "connect-src": ["'self'", "ws:", "wss:", process.env.FRONTEND_URL!],
        // Allow images from Cloudinary
        "img-src": ["'self'", "data:", "https://res.cloudinary.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  app.use(apiLimiter);
}

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.disable('x-powered-by')


if(process.env.NODE_ENV !== 'production'){
  app.use(morgan('dev'));
}

app.get('/api/health', (req:express.Request, res:express.Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      websocket: 'connected',
      onlineUsers: socketService.getOnlineUsers().length,
    },
  });
});

app.use('/api/', auditLogger());

app.use('/api/auth',
  process.env.NODE_ENV === 'production' ? authLimiter : [],
  authRoutes
);
app.use('/api/', [
  dashboardRoutes,
  userRoutes,
  workerRoutes,
  productionLineRoutes,
  assignmentRoutes,
  productRoutes,
  performanceRecordRoutes,
  accountRoutes,
  chatRoutes,
  insightsRoutes,
  auditRoutes,
]);

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

// Initial cleanup on server start
cleanupExpiredSessions()
  .then(() => console.log('Initial expired sessions cleaned up'))
  .catch(error => console.error('Error in initial cleanup:', error));
// Cleanup expired sessions every 24 hours
setInterval(async () => {
  try {
    await cleanupExpiredSessions();
    console.log('Expired sessions cleaned up');
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
  }
}, 24 * 60 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server ready on port ${PORT}`);
});

export { prisma, socketService };