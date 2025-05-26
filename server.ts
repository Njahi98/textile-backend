import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParse from "cookie-parser";
import { PrismaClient } from "./generated/prisma";

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true, // Important for cookies
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParse());

//Routes


// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
// app.use(errorHandler);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
}
);

export { prisma };