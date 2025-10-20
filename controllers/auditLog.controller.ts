import { Response, NextFunction } from 'express';
import { prisma } from '../server';
import { AuthenticatedRequest } from '../types';
import AuditService from '../utils/auditService';
import { AuditAction, AuditResource } from '../generated/prisma';

export const getAuditLogs = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = 1,
      limit = 50,
      startDate,
      endDate,
      userId,
      action,
      resource,
      search,
    } = req.query;

    const pageNum = Number(page) || 1;
    const limitNum = Math.min(Number(limit) || 50, 100); 
    const skip = (pageNum - 1) * limitNum;

    
    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate && typeof startDate === 'string') {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate && typeof endDate === 'string') {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        where.createdAt.lte = endOfDay;
      }
    }

    if (userId) {
      where.userId = Number(userId);
    }

    if (action) {
      where.action = action;
    }

    if (resource) {
      where.resource = resource;
    }

    if (search && typeof search === 'string' && search.length >= 2) {
      where.OR = [
        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          user: {
            username: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          user: {
            email: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    // Get audit logs with pagination
    const [auditLogs, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true,
      auditLogs,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalCount,
        hasNext: skip + auditLogs.length < totalCount,
        hasPrev: pageNum > 1,
      },
      filters: {
        startDate,
        endDate,
        userId,
        action,
        resource,
        search,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAuditLogById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const auditLogId = parseInt(req.params.id as string);

    if (isNaN(auditLogId)) {
      res.status(400).json({
        error: 'INVALID_ID',
        message: req.t('audit:errors.invalidId') ?? 'Invalid audit log ID provided',
      });
      return;
    }

    const auditLog = await prisma.auditLog.findUnique({
      where: { id: auditLogId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    if (!auditLog) {
      res.status(404).json({
        error: 'AUDIT_LOG_NOT_FOUND',
        message: req.t('audit:errors.notFound') ?? 'Audit log not found',
      });
      return;
    }

    res.json({
      success: true,
      auditLog,
    });
  } catch (error) {
    next(error);
  }
};

export const getAuditStats = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {

    const days = Number(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      totalActionsRaw,
      actionsByTypeRaw,
      actionsByResourceRaw,
      actionsByUserRaw,
      recentActivityRaw,
      topUsersRaw,
    ] = await Promise.all([
      // Total actions in the period
      prisma.auditLog.count({
        where: {
          createdAt: {
            gte: startDate,
          },
        },
      }),

      // Actions by type
      prisma.auditLog.groupBy({
        by: ['action'],
        where: {
          createdAt: {
            gte: startDate,
          },
        },
        _count: true,
        orderBy: {
          _count: {
            action: 'desc',
          },
        },
      }),

      // Actions by resource
      prisma.auditLog.groupBy({
        by: ['resource'],
        where: {
          createdAt: {
            gte: startDate,
          },
        },
        _count: true,
        orderBy: {
          _count: {
            resource: 'desc',
          },
        },
      }),

      // Actions by user
      prisma.auditLog.groupBy({
        by: ['userId'],
        where: {
          createdAt: {
            gte: startDate,
          },
          userId: {
            not: null,
          },
        },
        _count: true,
        orderBy: {
          _count: {
            userId: 'desc',
          },
        },
        take: 10,
      }),

      // Recent activity (last 24 hours by hour)
      prisma.$queryRaw<any>`
        SELECT 
          DATE_TRUNC('hour', "createdAt") as hour,
          COUNT(*) as count
        FROM "AuditLog"
        WHERE "createdAt" >= NOW() - INTERVAL '24 hours'
        GROUP BY DATE_TRUNC('hour', "createdAt")
        ORDER BY hour DESC
        LIMIT 24
      `,

      // Top 5 most active users
      prisma.$queryRaw<any>`
        SELECT 
          u.id,
          u.username,
          u.email,
          u."firstName",
          u."lastName",
          u.role,
          COUNT(a.id) as action_count
        FROM "AuditLog" a
        JOIN "User" u ON a."userId" = u.id
        WHERE a."createdAt" >= ${startDate}
        GROUP BY u.id, u.username, u.email, u."firstName", u."lastName", u.role
        ORDER BY action_count DESC
        LIMIT 5
      `,
    ]);

    // Normalize values to JSON-safe types
    const totalActions = Number(totalActionsRaw);

    const actionsByType = actionsByTypeRaw.map((item: any) => ({
      action: item.action,
      _count: Number((item as any)._count ?? (item as any)._count?.action ?? 0),
    }));

    const actionsByResource = actionsByResourceRaw.map((item: any) => ({
      resource: item.resource,
      _count: Number((item as any)._count ?? (item as any)._count?.resource ?? 0),
    }));

    const actionsByUser = actionsByUserRaw.map((item: any) => ({
      userId: typeof item.userId === 'bigint' ? Number(item.userId) : item.userId,
      _count: Number(item._count ?? 0),
    }));

    const recentActivity = (recentActivityRaw as any[]).map((row: any) => ({
      hour: new Date(row.hour).toISOString(),
      count: Number(row.count),
    }));

    const topUsers = (topUsersRaw as any[]).map((row: any) => ({
      id: typeof row.id === 'bigint' ? Number(row.id) : row.id,
      username: row.username,
      email: row.email,
      firstName: row.firstName ?? row["firstName"],
      lastName: row.lastName ?? row["lastName"],
      role: row.role,
      action_count: Number(row.action_count),
    }));

    // Get user details for actions by user
    const userIds = actionsByUser.map(item => item.userId).filter(Boolean);
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: userIds as number[],
        },
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    const enrichedActionsByUser = actionsByUser.map(item => ({
      ...item,
      user: users.find(u => u.id === item.userId),
    }));

    res.json({
      success: true,
      stats: {
        period: {
          days,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
        },
        totalActions,
        actionsByType: actionsByType.map(item => ({
          action: item.action,
          count: Number(item._count),
        })),
        actionsByResource: actionsByResource.map(item => ({
          resource: item.resource,
          count: Number(item._count),
        })),
        actionsByUser: enrichedActionsByUser,
        recentActivity,
        topUsers,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const exportAuditLogs = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get all audit logs (limit to 10k for safety)
    const auditLogs = await prisma.auditLog.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    // Log the export action
    await AuditService.logImportExport(
      'EXPORT',
      AuditResource.USER,
      req.user!.id,
      req,
      {
        filters: {},
        recordCount: auditLogs.length,
      },
      `Exported ${auditLogs.length} audit log records`
    );

    // Format data for CSV export
    const csvData = auditLogs.map(log => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      user_id: log.userId,
      username: log.user?.username || 'N/A',
      user_email: log.user?.email || 'N/A',
      user_role: log.user?.role || 'N/A',
      action: log.action,
      resource: log.resource,
      resource_id: log.resourceId || 'N/A',
      table_name: log.tableName || 'N/A',
      description: log.description || 'N/A',
      ip_address: log.ipAddress || 'N/A',
      user_agent: log.userAgent || 'N/A',
      old_values: log.oldValues ? JSON.stringify(log.oldValues) : 'N/A',
      new_values: log.newValues ? JSON.stringify(log.newValues) : 'N/A',
      metadata: log.metadata ? JSON.stringify(log.metadata) : 'N/A',
    }));

    // Convert to CSV
    const csvHeaders = Object.keys(csvData[0] || {}).join(',');
    const csvRows = csvData.map(row =>
      Object.values(row).map(value =>
        typeof value === 'string' && value.includes(',')
          ? `"${value.replace(/"/g, '""')}"`
          : value
      ).join(',')
    );
    const csvContent = [csvHeaders, ...csvRows].join('\n');

    // Set response headers for file download
    const filename = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(csvContent));

    res.send(csvContent);
  } catch (error) {
    next(error);
  }
};


export const cleanupAuditLogs = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const daysToKeep = Number(req.query.days) || 365;
    
    if (daysToKeep < 30) {
      res.status(400).json({
        error: 'INVALID_DAYS',
        message: req.t('audit:errors.invalidDays') ?? 'Cannot cleanup audit logs newer than 30 days',
      });
      return;
    }

    const deletedCount = await AuditService.cleanup(daysToKeep);

    // Log the cleanup action
    await AuditService.log({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      resource: AuditResource.USER,
      description: `Cleaned up ${deletedCount} audit log records older than ${daysToKeep} days`,
      metadata: { daysToKeep, deletedCount },
    }, req);
    
    res.json({
      success: true,
      message: req.t('audit:messages.cleanupSuccess', { 
        deletedCount, 
        daysToKeep 
      }) ?? `Successfully cleaned up ${deletedCount} audit log records`,
      deletedCount,
      daysToKeep,
    });
  } catch (error) {
    next(error);
  }
};

// Log frontend CSV export actions
 
export const logFrontendExport = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { exportType, metadata } = req.body;

    if (!exportType || !metadata) {
      res.status(400).json({
        success: false,
        message: 'Export type and metadata are required',
      });
      return; 
    }

    let resource: AuditResource;
    let description: string;

    switch (exportType) {
      case 'performance_analytics':
        resource = AuditResource.PERFORMANCE_RECORD;
        description = `Exported performance analytics data (${metadata.dataPoints} data points, ${metadata.groupBy} grouping)`;
        break;
      case 'performance_ai_insights':
        resource = AuditResource.PERFORMANCE_RECORD;
        description = `Exported AI insights report (${metadata.dataAnalyzed?.totalRecords || 0} records analyzed)`;
        break;
      default:
        res.status(400).json({
          success: false,
          message: 'Invalid export type',
        });
        return;
    }

    // Log the export action
    await AuditService.logImportExport(
      'EXPORT',
      resource,
      req.user!.id,
      req,
      {
        exportType,
        ...metadata,
      },
      description
    );

    res.json({
      success: true,
      message: 'Export action logged successfully',
    });
    return;
  } catch (error) {
    next(error);
  }
};