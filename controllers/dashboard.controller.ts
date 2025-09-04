import { Request, Response, NextFunction } from 'express';
import { prisma } from '../server';

export const getDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get current date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    // Get overall counts
    const [
      totalWorkers,
      activeWorkers,
      totalProductionLines,
      activeProductionLines,
      totalProducts,
      activeProducts,
      totalUsers
    ] = await Promise.all([
      prisma.worker.count(),
      prisma.worker.count({
        where: {
          assignments: {
            some: {
              date: {
                gte: today,
                lt: tomorrow
              }
            }
          }
        }
      }),
      prisma.productionLine.count(),
      prisma.productionLine.count({ where: { isActive: true } }),
      prisma.product.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.user.count({ where: { status: 'active' } })
    ]);

    // Get today's production
    const todayProduction = await prisma.performanceRecord.aggregate({
      _sum: { piecesMade: true },
      _avg: { errorRate: true },
      _count: true,
      where: {
        date: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    // Get month's production
    const monthProduction = await prisma.performanceRecord.aggregate({
      _sum: { piecesMade: true },
      _avg: { errorRate: true },
      _count: true,
      where: {
        date: {
          gte: thisMonthStart,
          lt: nextMonthStart
        }
      }
    });

    // Get today's assignments count
    const todayAssignments = await prisma.assignment.count({
      where: {
        date: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    res.json({
      success: true,
      stats: {
        workers: {
          total: totalWorkers,
          activeToday: activeWorkers
        },
        productionLines: {
          total: totalProductionLines,
          active: activeProductionLines
        },
        products: {
          total: totalProducts,
          active: activeProducts
        },
        users: {
          total: totalUsers
        },
        production: {
          today: {
            pieces: Number(todayProduction._sum.piecesMade) || 0,
            avgErrorRate: Number(todayProduction._avg.errorRate) || 0,
            records: todayProduction._count
          },
          month: {
            pieces: Number(monthProduction._sum.piecesMade) || 0,
            avgErrorRate: Number(monthProduction._avg.errorRate) || 0,
            records: monthProduction._count
          }
        },
        assignments: {
          today: todayAssignments
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getProductionMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Get production by production line for today
    const productionByLine = await prisma.performanceRecord.groupBy({
      by: ['productionLineId'],
      _sum: { piecesMade: true },
      _avg: { errorRate: true, timeTaken: true },
      _count: true,
      where: {
        date: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    // Add production line details
    const metricsWithDetails = await Promise.all(
      productionByLine.map(async (metric) => {
        const productionLine = await prisma.productionLine.findUnique({
          where: { id: metric.productionLineId },
          select: { 
            id: true, 
            name: true, 
            targetOutput: true, 
            capacity: true,
            isActive: true 
          }
        });

        const efficiency = productionLine?.targetOutput 
          ? ((Number(metric._sum.piecesMade) || 0) / productionLine.targetOutput) * 100 
          : null;

        return {
          productionLine,
          production: Number(metric._sum.piecesMade) || 0,
          avgErrorRate: Number(metric._avg.errorRate) || 0,
          avgTimeTaken: Number(metric._avg.timeTaken) || 0,
          recordCount: metric._count,
          efficiency
        };
      })
    );

    // Sort by production (highest first)
    metricsWithDetails.sort((a, b) => b.production - a.production);

    res.json({
      success: true,
      metrics: metricsWithDetails
    });
  } catch (error) {
    next(error);
  }
};

export const getWorkerPerformance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Get top performers for today
    const topPerformers = await prisma.performanceRecord.groupBy({
      by: ['workerId'],
      _sum: { piecesMade: true },
      _avg: { errorRate: true },
      _count: true,
      where: {
        date: {
          gte: today,
          lt: tomorrow
        }
      },
      orderBy: {
        _sum: {
          piecesMade: 'desc'
        }
      },
      take: 10
    });

    // Add worker details
    const performersWithDetails = await Promise.all(
      topPerformers.map(async (performer) => {
        const worker = await prisma.worker.findUnique({
          where: { id: performer.workerId },
          select: { 
            id: true, 
            name: true, 
            cin: true, 
            role: true 
          }
        });

        return {
          worker,
          production: Number(performer._sum.piecesMade) || 0,
          avgErrorRate: Number(performer._avg.errorRate) || 0,
          recordCount: performer._count
        };
      })
    );

    res.json({
      success: true,
      topPerformers: performersWithDetails
    });
  } catch (error) {
    next(error);
  }
};

export const getRecentActivities = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get recent assignments
    const recentAssignments = await prisma.assignment.findMany({
      include: {
        worker: {
          select: { id: true, name: true, cin: true }
        },
        productionLine: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // Get recent performance records
    const recentPerformance = await prisma.performanceRecord.findMany({
      include: {
        worker: {
          select: { id: true, name: true, cin: true }
        },
        product: {
          select: { id: true, name: true, code: true }
        },
        productionLine: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // Get recent worker additions
    const recentWorkers = await prisma.worker.findMany({
      select: {
        id: true,
        name: true,
        cin: true,
        role: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    res.json({
      success: true,
      activities: {
        assignments: recentAssignments,
        performanceRecords: recentPerformance,
        newWorkers: recentWorkers
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getProductionTrends = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get last 7 days of data
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    // Get production data grouped by date
    const productionByDate = await prisma.performanceRecord.groupBy({
      by: ['date'],
      _sum: { piecesMade: true },
      _avg: { errorRate: true },
      _count: true,
      where: {
        date: {
          gte: sevenDaysAgo,
          lte: today
        }
      },
      orderBy: { date: 'asc' }
    });

    // Create a complete date range with zeros for missing dates
    const trends = [];
    const currentDate = new Date(sevenDaysAgo);
    
    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayData = productionByDate.find(
        p => p.date?.toISOString().split('T')[0] === dateStr
      );

      trends.push({
        date: dateStr,
        production: dayData ? Number(dayData._sum.piecesMade) || 0 : 0,
        avgErrorRate: dayData ? Number(dayData._avg.errorRate) || 0 : 0,
        recordCount: dayData ? dayData._count : 0
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate trend percentage (compare today vs 7 days ago)
    const todayProduction = trends[trends.length - 1]?.production || 0;
    const weekAgoProduction = trends[0]?.production || 0;
    const trendPercentage = weekAgoProduction > 0 
      ? ((todayProduction - weekAgoProduction) / weekAgoProduction) * 100 
      : 0;

    res.json({
      success: true,
      trends: {
        data: trends,
        summary: {
          totalProduction: trends.reduce((sum, t) => sum + t.production, 0),
          avgDailyProduction: trends.reduce((sum, t) => sum + t.production, 0) / 7,
          trendPercentage: Number(trendPercentage.toFixed(2))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};