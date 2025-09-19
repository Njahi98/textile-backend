import { Request } from 'express';
import { prisma } from '../server';
import { AuditAction, AuditResource } from '../generated/prisma';

interface AuditLogData {
  userId?: number;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string | number | null;
  tableName?: string | null;
  oldValues?: any;
  newValues?: any;
  description?: string | null;
  metadata?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
}

class AuditService {
  /**
   * Log an audit entry
   */
  static async log(data: AuditLogData, req?: Request) {
    try {
      const auditData: any = {
        userId: data.userId || null,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId ? String(data.resourceId) : null,
        tableName: data.tableName || null,
        oldValues: data.oldValues || null,
        newValues: data.newValues || null,
        description: data.description || null,
        metadata: data.metadata || null,
        ipAddress: data.ipAddress || this.getClientIp(req),
        userAgent: data.userAgent || req?.get('User-Agent') || null,
      };

      
      const result = await prisma.auditLog.create({
        data: auditData,
      });
      
    } catch (error) {
      // Don't throw errors for audit logging to prevent disrupting main functionality
      console.error('Audit logging error:', error);
    }
  }

  /**
   * Log user authentication events
   */
  static async logAuth(
    action: 'LOGIN' | 'LOGOUT',
    userId: number,
    req: Request,
    metadata?: any
  ) {
    await this.log({
      userId,
      action: action === 'LOGIN' ? AuditAction.LOGIN : AuditAction.LOGOUT,
      resource: AuditResource.AUTH,
      description: action === 'LOGIN' ? 'User logged in' : 'User logged out',
      metadata,
    }, req);
  }

  /**
   * Log CRUD operations
   */
  static async logCrud(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    resource: AuditResource,
    resourceId: string | number,
    userId: number,
    req: Request,
    options?: {
      tableName?: string;
      oldValues?: any;
      newValues?: any;
      description?: string;
    }
  ) {
    const auditAction = action === 'CREATE' ? AuditAction.CREATE : 
                       action === 'UPDATE' ? AuditAction.UPDATE : 
                       AuditAction.DELETE;

    const description = options?.description || 
                       `${action.toLowerCase()} ${resource.toLowerCase()}`;

    await this.log({
      userId,
      action: auditAction,
      resource,
      resourceId,
      tableName: options?.tableName || null,
      oldValues: options?.oldValues,
      newValues: options?.newValues,
      description,
    }, req);
  }

  /**
   * Log import/export operations
   */
  static async logImportExport(
    action: 'IMPORT' | 'EXPORT',
    resource: AuditResource,
    userId: number,
    req: Request,
    metadata?: any,
    description?: string
  ) {
    await this.log({
      userId,
      action: action === 'IMPORT' ? AuditAction.IMPORT : AuditAction.EXPORT,
      resource,
      metadata,
      description: description || `${action.toLowerCase()} ${resource.toLowerCase()}`,
    }, req);
  }

  /**
   * Get client IP address from request
   */
  private static getClientIp(req?: Request): string | null {
    if (!req) return null;
    
    return req.ip ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           (req.connection as any)?.socket?.remoteAddress ||
           req.get('X-Forwarded-For') ||
           req.get('X-Real-IP') ||
           null;
  }

  /**
   * Clean up old audit logs
   */
  static async cleanup(daysToKeep: number = 365) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      return result.count;
    } catch (error) {
      console.error('Error cleaning up audit logs:', error);
      return 0;
    }
  }
}

export default AuditService;