import { Request } from 'express';
import { prisma } from '../server';
import crypto from 'crypto';

// Helper function to extract device info from request
export const getDeviceInfo = (req: Request): string => {
  const userAgent = req.get('User-Agent') || 'Unknown';
  const acceptLanguage = req.get('Accept-Language') || '';
  const acceptEncoding = req.get('Accept-Encoding') || '';
  
  // Create a device fingerprint from available headers
  const deviceFingerprint = `${userAgent}|${acceptLanguage}|${acceptEncoding}`;
  
  // Hash it to make it shorter and more consistent
  return crypto.createHash('sha256').update(deviceFingerprint).digest('hex').substring(0, 16);
};

// Helper function to get client IP
export const getClientIP = (req: Request): string => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         (req.connection as any)?.socket?.remoteAddress || 
         'unknown';
};

// Helper function to create a new session
export const createUserSession = async (
  userId: number, 
  refreshToken: string, 
  req: Request
): Promise<void> => {
  const deviceInfo = getDeviceInfo(req);
  const ipAddress = getClientIP(req);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Check if user already has 3 active sessions
  const activeSessions = await prisma.userSession.findMany({
    where: {
      userId,
      isActive: true,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'asc' }
  });

  // If user has 3 or more active sessions, remove the oldest one
  if (activeSessions.length >= 3) {
    const oldestSession = activeSessions[0];
    await prisma.userSession.delete({
      where: { id: oldestSession.id }
    });
  }

  // Create new session
  await prisma.userSession.create({
    data: {
      userId,
      refreshToken,
      deviceInfo,
      ipAddress,
      expiresAt
    }
  });
};

// Helper function to validate and get session
export const validateUserSession = async (refreshToken: string): Promise<{
  userId: number;
  sessionId: number;
} | null> => {
  const session = await prisma.userSession.findUnique({
    where: {
      refreshToken,
      isActive: true,
      expiresAt: { gt: new Date() }
    }
  });

  if (!session) {
    return null;
  }

  return {
    userId: session.userId,
    sessionId: session.id
  };
};

// Helper function to revoke a specific session
export const revokeUserSession = async (refreshToken: string): Promise<void> => {
  await prisma.userSession.updateMany({
    where: { refreshToken },
    data: { isActive: false }
  });
};

// Helper function to revoke all sessions for a user
export const revokeAllUserSessions = async (userId: number): Promise<void> => {
  await prisma.userSession.updateMany({
    where: { userId },
    data: { isActive: false }
  });
};

// Helper function to clean up expired sessions
export const cleanupExpiredSessions = async (): Promise<void> => {
  await prisma.userSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { isActive: false }
      ]
    }
  });
};
