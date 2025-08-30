import { prisma } from "server";

interface NotificationData {
  type: 'NEW_MESSAGE' | 'MENTION' | 'SYSTEM' | 'PERFORMANCE_ALERT';
  title: string;
  content: string;
  data?: Record<string, any>;
}

export class NotificationService {
  
  static async createAndSendNotification(userId: number, notificationData: NotificationData) {
    return await global.socketService.createNotification(userId, notificationData);
  }


static async notifyPerformanceAlert(performanceData: any) {
  const isGoodPerformance = performanceData.errorRate < 5; // Assuming 5% is the threshold

  const targetUsers = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'SUPERADMIN','USER'] }, 
      status: 'active',
    },
    select: { id: true },
  });

  if (targetUsers.length === 0) return;

  const notificationPayload = {
    type: 'PERFORMANCE_ALERT' as const,
    title: isGoodPerformance ? 'Worker Performance Update' : 'Worker Performance Alert',
    content: isGoodPerformance 
      ? `Worker #${performanceData.workerId} has excellent performance with ${performanceData.errorRate}% error rate`
      : `Worker #${performanceData.workerId} needs attention - error rate at ${performanceData.errorRate}%`,
    data: {
      performanceRecordId: performanceData.id,
      errorRate: performanceData.errorRate,
      piecesMade: performanceData.piecesMade,
      productId: performanceData.productId,
      workerId: performanceData.workerId,
    },
  };

  const promises = targetUsers.map(user =>
    this.createAndSendNotification(user.id, notificationPayload)
  );

  return await Promise.all(promises);
}


  static async notifySystemMessage(userIds: number[], title: string, content: string, additionalData?: any) {
    const promises = userIds.map(userId => 
      this.createAndSendNotification(userId, {
        type: 'SYSTEM',
        title,
        content,
        data: additionalData,
      })
    );

    return await Promise.all(promises);
  }

  // Bulk notification for all active users
  static async notifyAllUsers(title: string, content: string, additionalData?: any) {
    return {
      title,
      content,
      data: additionalData,
    };
  }
}

export default NotificationService;