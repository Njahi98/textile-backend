import { Request, Response, NextFunction } from 'express';
import { prisma } from '../server';
import GeminiService from '../utils/geminiService';
import { InsightsQueryInput } from '../utils/validation';


export const getAIInsights = async (
  req: Request<{}, {}, {}, InsightsQueryInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { startDate, endDate, workerId, productionLineId, productId }
     = (req as Request<{}, {}, {}, InsightsQueryInput> & { validatedQuery: InsightsQueryInput}).validatedQuery;

    // Parse dates or default to last 30 days
    let start: Date;
    let end: Date;

    if (startDate) {
      start = new Date(startDate);
      if (isNaN(start.getTime())) {
        res.status(400).json({
          error: 'INVALID_START_DATE',
          message: req.t('insights:errors.invalidStartDate') ?? 'Invalid start date format',
        });
        return;
      }
    } else {
      start = new Date();
      start.setDate(start.getDate() - 30);
    }

    if (endDate) {
      end = new Date(endDate);
      if (isNaN(end.getTime())) {
        res.status(400).json({
          error: 'INVALID_END_DATE',
          message: req.t('insights:errors.invalidEndDate') ?? 'Invalid end date format',
        });
        return;
      }
    } else {
      end = new Date();
    }

    // Build where clause
    const where: any = {
      date: {
        gte: start,
        lte: end,
      },
      worker: { isDeleted: false },
      product: { isDeleted: false },
      productionLine: { isDeleted: false },
    };

    if (workerId) where.workerId = workerId;
    if (productionLineId) where.productionLineId = productionLineId;
    if (productId) where.productId = productId;

    // Gather all the data needed for insights
    const [
      overallMetrics,
      workerMetrics,
      productionLineMetrics,
      productMetrics,
      trendData,
    ] = await Promise.all([
      // Overall production metrics
      prisma.performanceRecord.aggregate({
        where,
        _sum: { piecesMade: true },
        _avg: { errorRate: true, timeTaken: true },
        _count: true,
      }),

      // Worker performance metrics
      prisma.performanceRecord.groupBy({
        by: ['workerId'],
        where,
        _sum: { piecesMade: true },
        _avg: { errorRate: true, timeTaken: true },
        _count: true,
        orderBy: {
          _sum: { piecesMade: 'desc' }
        },
        take: 10,
      }),

      // Production line metrics
      prisma.performanceRecord.groupBy({
        by: ['productionLineId'],
        where,
        _sum: { piecesMade: true },
        _avg: { errorRate: true, timeTaken: true },
        _count: true,
        orderBy: {
          _sum: { piecesMade: 'desc' }
        }
      }),

      // Product metrics
      prisma.performanceRecord.groupBy({
        by: ['productId'],
        where,
        _sum: { piecesMade: true },
        _avg: { errorRate: true, timeTaken: true },
        _count: true,
        orderBy: {
          _sum: { piecesMade: 'desc' }
        },
        take: 10,
      }),

      // Last 7 days trend data
      prisma.performanceRecord.groupBy({
        by: ['date'],
        where: {
          ...where,
          date: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            lte: end,
          }
        },
        _sum: { piecesMade: true },
        _avg: { errorRate: true, timeTaken: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    // Enrich worker metrics with worker details
    const enrichedWorkerMetrics = await Promise.all(
      workerMetrics.map(async (metric) => {
        const worker = await prisma.worker.findUnique({
          where: { id: metric.workerId },
          select: { id: true, name: true, role: true }
        });

        const performanceScore = Math.max(0, 100 - Number(metric._avg.errorRate || 0));

        return {
          worker: worker || { id: metric.workerId, name: 'Unknown Worker', role: null },
          totalProduction: Number(metric._sum.piecesMade || 0),
          avgErrorRate: Number(metric._avg.errorRate || 0),
          avgTimeTaken: Number(metric._avg.timeTaken || 0),
          recordCount: metric._count,
          performanceScore
        };
      })
    );

    // Enrich production line metrics
    const enrichedProductionLineMetrics = await Promise.all(
      productionLineMetrics.map(async (metric) => {
        const productionLine = await prisma.productionLine.findUnique({
          where: { id: metric.productionLineId },
          select: { id: true, name: true, targetOutput: true }
        });

        const totalProduction = Number(metric._sum.piecesMade || 0);
        const efficiency = productionLine?.targetOutput 
          ? (totalProduction / productionLine.targetOutput) * 100 
          : 0;

        return {
          productionLine: productionLine || { id: metric.productionLineId, name: 'Unknown Line', targetOutput: null },
          totalProduction,
          avgErrorRate: Number(metric._avg.errorRate || 0),
          avgTimeTaken: Number(metric._avg.timeTaken || 0),
          efficiency: Math.min(efficiency, 100),
          recordCount: metric._count
        };
      })
    );

    // Format trend data
    const trends = trendData.map(trend => ({
      date: trend.date?.toISOString().split('T')[0] || '',
      production: Number(trend._sum.piecesMade || 0),
      errorRate: Number(trend._avg.errorRate || 0),
      timeTaken: Number(trend._avg.timeTaken || 0)
    }));

    // Calculate efficiency
    const avgErrorRate = Number(overallMetrics._avg.errorRate || 0);
    const efficiency = Math.max(0, 100 - avgErrorRate);

    // Prepare data for Gemini analysis
    const insightData = {
      productionMetrics: {
        totalProduction: Number(overallMetrics._sum.piecesMade || 0),
        avgErrorRate,
        avgTimeTaken: Number(overallMetrics._avg.timeTaken || 0),
        efficiency
      },
      workerMetrics: enrichedWorkerMetrics,
      productionLineMetrics: enrichedProductionLineMetrics,
      trends,
    };

    // Generate AI insights
    const geminiService = new GeminiService();
    const insights = await geminiService.generateInsights(insightData);

    res.json({
      success: true,
      insights,
      dataAnalyzed: {
        dateRange: { startDate: start, endDate: end },
        totalRecords: overallMetrics._count,
        workersAnalyzed: enrichedWorkerMetrics.length,
        productionLinesAnalyzed: enrichedProductionLineMetrics.length,
        productsAnalyzed: productMetrics.length
      }
    });

  } catch (error) {
    console.error('Insights generation error:', error);
    next(error);
  }
};