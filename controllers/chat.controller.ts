import { Request, Response, NextFunction } from 'express';
import { prisma } from '../server';
import { AuthenticatedRequest } from '../types';
import { uploadFileToCloudinary } from '../utils/imageUpload';
import { CreateConversationRequest } from '@/utils/validation';


// Extend AuthenticatedRequest to include validated query
interface ValidatedRequest extends AuthenticatedRequest {
  validatedQuery?: {
    page: number;
    limit: number;
  };
}

export const getConversations = async (
  req: ValidatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    // Use validated query params or fallback to manual parsing
    const page = req.validatedQuery?.page || parseInt(req.query.page as string) || 1;
    const limit = req.validatedQuery?.limit || parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId,
            isActive: true,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatarUrl:true,
              },
            },
          },
          where: {
            isActive: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatarUrl:true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                readReceipts: {
                  none: {
                    userId,
                  },
                },
                senderId: {
                  not: userId,
                },
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      skip,
      take: limit,
    });

    const total = await prisma.conversation.count({
      where: {
        participants: {
          some: {
            userId,
            isActive: true,
          },
        },
      },
    });

    res.json({
      success: true,
      conversations: conversations.map(conv => ({
        ...conv,
        unreadCount: conv._count.messages,
        lastMessage: conv.messages[0] || null,
        messages: undefined, // Remove messages array, we only want lastMessage
        _count: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getConversationMessages = async (
  req: Request<{ conversationId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const conversationId = parseInt(req.params.conversationId);
    const userId = (req as AuthenticatedRequest).user!.id;
    // Use validated query params or fallback to manual parsing
    const page = (req as ValidatedRequest).validatedQuery?.page || parseInt(req.query.page as string) || 1;
    const limit = (req as ValidatedRequest).validatedQuery?.limit || parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    if (isNaN(conversationId)) {
      res.status(400).json({
        error: 'INVALID_ID',
        message: 'Invalid conversation ID provided'
      });
      return;
    }

    // Verify user is participant
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
        isActive: true,
      },
    });

    if (!participant) {
      res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'You are not a participant in this conversation'
      });
      return;
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        isDeleted: false,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatarUrl:true,
          },
        },
        readReceipts: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    });

    const totalMessages = await prisma.message.count({
      where: {
        conversationId,
        isDeleted: false,
      },
    });

    res.json({
      success: true,
      messages: messages.reverse(), // Reverse to show oldest first
      pagination: {
        page,
        limit,
        total: totalMessages,
        totalPages: Math.ceil(totalMessages / limit),
        hasMore: skip + limit < totalMessages,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createConversation = async (
  req: Request<{}, {}, CreateConversationRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { name, participantIds, isGroup } = req.body;

    // Add creator to participants if not already included
    const allParticipantIds = Array.from(new Set([userId, ...participantIds]));

    // For direct messages, check if conversation already exists
    if (!isGroup && allParticipantIds.length === 2) {
      // Find conversations that have exactly these participants
      const existingConversations = await prisma.conversation.findMany({
        where: {
          isGroup: false,
          participants: {
            every: {
              userId: {
                in: allParticipantIds,
              },
            },
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            where: {
              isActive: true,
            },
          },
        },
      });

      // Filter to find conversation with exactly the right number of participants
      const existingConversation = existingConversations.find(
        conv => conv.participants.length === allParticipantIds.length
      );

      if (existingConversation) {
        res.json({
          success: true,
          conversation: existingConversation,
          message: 'Existing conversation found',
        });
        return;
      }
    }

    // Verify all participants exist and are active
    const users = await prisma.user.findMany({
      where: {
        id: { in: allParticipantIds },
        status: 'active',
      },
      select: { id: true },
    });

    if (users.length !== allParticipantIds.length) {
      res.status(400).json({
        error: 'INVALID_PARTICIPANTS',
        message: 'One or more participants not found or inactive'
      });
      return;
    }

    // Create conversation with participants
    const conversation = await prisma.conversation.create({
      data: {
        name: isGroup ? name : null,
        isGroup,
        createdBy: userId,
        participants: {
          create: allParticipantIds.map(id => ({
            userId: id,
          })),
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      conversation,
      message: 'Conversation created successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getNotifications = async (
  req: ValidatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    // Use validated query params or fallback to manual parsing
    const page = req.validatedQuery?.page || parseInt(req.query.page as string) || 1;
    const limit = req.validatedQuery?.limit || parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    const total = await prisma.notification.count({
      where: { userId },
    });

    res.json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const markNotificationsRead = async (
  req: Request<{}, {}, { notificationIds?: number[]; markAll?: boolean }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { notificationIds, markAll = false } = req.body;

    if (markAll) {
      await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });
    } else if (notificationIds && notificationIds.length > 0) {
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId, // Ensure user can only mark their own notifications
        },
        data: {
          isRead: true,
        },
      });
    } else {
      res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Either provide notificationIds or set markAll to true'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};

export const searchUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = req.query.q as string;
    const currentUserId = (req as AuthenticatedRequest).user!.id;

    if (!query || query.length < 2) {
      res.status(400).json({
        error: 'INVALID_QUERY',
        message: 'Search query must be at least 2 characters long'
      });
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } }, // Exclude current user
          { status: 'active' },
          {
            OR: [
              { username: { contains: query, mode: 'insensitive' } },
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
      },
      take: 10,
    });

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    next(error);
  }
};


export const testNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
            const notification = await global.socketService.createNotification(userId, {
        type: 'SYSTEM',
        title: 'Test Notification',
        content: 'This is a test notification to verify the notification system is working!',
        data: { test: true }
      });

      res.json({
        success: true,
        message: 'Test notification created',
        notification
      });
    } catch (error) {
      next(error);
    }
  }


export const uploadFile = async (
  req: Request<{ conversationId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const conversationId = parseInt(req.params.conversationId);
    const userId = (req as AuthenticatedRequest).user!.id;

    if (isNaN(conversationId)) {
      res.status(400).json({
        error: 'INVALID_ID',
        message: 'Invalid conversation ID provided'
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        error: 'NO_FILE',
        message: 'No file provided'
      });
      return;
    }

    // Verify user is participant
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
        isActive: true,
      },
    });

    if (!participant) {
      res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'You are not a participant in this conversation'
      });
      return;
    }

    try {
      // Upload file to Cloudinary
      const uploadResult = await uploadFileToCloudinary(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        'chat-files'
      );

      // Determine message type
      let messageType: 'IMAGE' | 'VIDEO' | 'FILE' = 'FILE';
      if (req.file.mimetype.startsWith('image/')) {
        messageType = 'IMAGE';
      } else if (req.file.mimetype.startsWith('video/')) {
        messageType = 'VIDEO';
      }

      // Create message with file data
      const message = await prisma.message.create({
        data: {
          conversationId,
          senderId: userId,
          content: req.file.originalname, // Store original filename as content
          messageType,
          fileUrl: uploadResult.url,
          fileName: uploadResult.fileName,
          fileSize: uploadResult.fileSize,
          filePublicId: uploadResult.publicId,
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          readReceipts: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          },
        },
      });

      // Update conversation timestamp
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      // Emit through socket if available
      if (global.socketService) {
        global.socketService.sendToConversation(conversationId, 'new_message', message);
      }

      res.json({
        success: true,
        message,
      });
    } catch (uploadError) {
      res.status(400).json({
        error: 'FILE_UPLOAD_FAILED',
        message: 'Failed to upload file'
      });
      return;
    }
  } catch (error) {
    next(error);
  }
};