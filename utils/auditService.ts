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
   * Handles proxy headers properly for Render.io and other cloud providers
   */
  private static getClientIp(req?: Request): string | null {
    if (!req) return null;
    
    // Check X-Forwarded-For header first (most common for proxies)
    const xForwardedFor = req.get('X-Forwarded-For');
    if (xForwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first one (original client)
      const ips = xForwardedFor.split(',').map(ip => ip.trim());
      const clientIp = ips[0];
      
      // Validate that it's not a private/internal IP
      if (clientIp && !this.isPrivateIp(clientIp)) {
        return clientIp;
      }
    }
    
    // Check X-Real-IP header
    const xRealIp = req.get('X-Real-IP');
    if (xRealIp && !this.isPrivateIp(xRealIp)) {
      return xRealIp;
    }
    
    // Check CF-Connecting-IP (Cloudflare)
    const cfConnectingIp = req.get('CF-Connecting-IP');
    if (cfConnectingIp && !this.isPrivateIp(cfConnectingIp)) {
      return cfConnectingIp;
    }
    
    // Check X-Client-IP header
    const xClientIp = req.get('X-Client-IP');
    if (xClientIp && !this.isPrivateIp(xClientIp)) {
      return xClientIp;
    }
    
    // Fallback to Express's req.ip (should work with trust proxy)
    if (req.ip && !this.isPrivateIp(req.ip)) {
      return req.ip;
    }
    
    // Last resort: connection remote address
    const connectionIp = req.connection?.remoteAddress || req.socket?.remoteAddress;
    if (connectionIp && !this.isPrivateIp(connectionIp)) {
      return connectionIp;
    }
    
    return null;
  }

  /**
   * Check if an IP address is private/internal
   */
  private static isPrivateIp(ip: string): boolean {
    // Remove IPv6 prefix if present
    const cleanIp = ip.replace(/^::ffff:/, '');
    
    // Check for private IP ranges
    const privateRanges = [
      /^10\./,                    // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./,              // 192.168.0.0/16
      /^127\./,                   // 127.0.0.0/8 (localhost)
      /^169\.254\./,              // 169.254.0.0/16 (link-local)
      /^::1$/,                    // IPv6 localhost
      /^fc00:/,                   // IPv6 private
      /^fe80:/,                   // IPv6 link-local
    ];
    
    return privateRanges.some(range => range.test(cleanIp));
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