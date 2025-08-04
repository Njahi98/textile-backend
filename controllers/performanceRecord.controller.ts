import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../server';

interface IdParams {
  id: string;
}

type Shift = 'morning' | 'afternoon' | 'night';

interface PerformanceRecordQueryInput {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  workerId?: number;
  productId?: number;
  productionLineId?: number;
  shift?: Shift;
}

interface CreatePerformanceRecordInput {
  workerId: number;
  productId: number;
  productionLineId: number;
  date: Date;
  piecesMade: number;
  shift: Shift;
  timeTaken: number;
  errorRate: number;
}

interface UpdatePerformanceRecordInput {
  workerId?: number;
  productId?: number;
  productionLineId?: number;
  date?: Date;
  piecesMade?: number;
  shift?: Shift;
  timeTaken?: number;
  errorRate?: number;
}

interface DateGroup {
  date: string;
  records: Array<{
    date: Date;
    piecesMade: number;
    errorRate: number;
    timeTaken: number;
  }>;
  totalPieces: number;
  totalErrorRate: number;
  totalTimeTaken: number;
  count: number;
}

interface DateGroups {
  [key: string]: DateGroup;
}

export const getAllPerformanceRecords = async (
  req: Request<{}, {}, {}, PerformanceRecordQueryInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = 1,
      limit = 20,
      ...filters
    } = req.query;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const {
      startDate,
      endDate,
      workerId,
      productId,
      productionLineId,
      shift,
    } = filters;

    // Build where clause
    const where: any = {};

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    if (workerId) where.workerId = workerId;
    if (productId) where.productId = productId;
    if (productionLineId) where.productionLineId = productionLineId;
    if (shift) where.shift = shift;

    // Get performance records with pagination
    const [performanceRecords, totalCount] = await Promise.all([
      prisma.performanceRecord.findMany({
        where,
        include: {
          worker: {
            select: {
              id: true,
              name: true,
              cin: true,
              role: true,
            }
          },
          product: {
            select: {
              id: true,
              name: true,
              code: true,
              category: true,
            }
          },
          productionLine: {
            select: {
              id: true,
              name: true,
              location: true,
            }
          }
        },
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.performanceRecord.count({ where })
    ]);

    res.status(200).json({
      success: true,
      performanceRecords,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalCount,
        hasNext: skip + performanceRecords.length < totalCount,
        hasPrev: pageNum > 1,
      }
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const getPerformanceRecordById = async (
  req: Request<IdParams>,
  res: Response,
  next: NextFunction
) => {
  try {
    const recordId = parseInt(req.params.id);

    if (isNaN(recordId)) {
      res.status(400).json({
        error: 'INVALID_ID',
        message: 'Invalid performance record ID provided',
      });
      return;
    }

    const performanceRecord = await prisma.performanceRecord.findUnique({
      where: { id: recordId },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            cin: true,
            role: true,
            email: true,
            phone: true,
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            category: true,
            unitPrice: true,
          }
        },
        productionLine: {
          select: {
            id: true,
            name: true,
            description: true,
            location: true,
            capacity: true,
            targetOutput: true,
          }
        }
      }
    });

    if (!performanceRecord) {
      res.status(404).json({
        error: 'PERFORMANCE_RECORD_NOT_FOUND',
        message: 'Performance record not found',
      });
      return;
    }

    res.json({ success: true, performanceRecord });
    return;
  } catch (error) {
    next(error);
  }
};

export const createPerformanceRecord = async (
  req: Request<{}, {}, CreatePerformanceRecordInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { 
      workerId, 
      productId, 
      productionLineId, 
      date, 
      piecesMade, 
      shift, 
      timeTaken, 
      errorRate 
    } = req.body;

    // Check if worker exists
    const worker = await prisma.worker.findUnique({
      where: { id: workerId }
    });

    if (!worker) {
      res.status(404).json({
        error: 'WORKER_NOT_FOUND',
        message: 'Worker not found',
      });
      return;
    }

    // Check if product exists and is active
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      res.status(404).json({
        error: 'PRODUCT_NOT_FOUND',
        message: 'Product not found',
      });
      return;
    }

    if (!product.isActive) {
      res.status(400).json({
        error: 'PRODUCT_INACTIVE',
        message: 'Cannot create performance record for inactive product',
      });
      return;
    }

    // Check if production line exists and is active
    const productionLine = await prisma.productionLine.findUnique({
      where: { id: productionLineId }
    });

    if (!productionLine) {
      res.status(404).json({
        error: 'PRODUCTION_LINE_NOT_FOUND',
        message: 'Production line not found',
      });
      return;
    }

    if (!productionLine.isActive) {
      res.status(400).json({
        error: 'PRODUCTION_LINE_INACTIVE',
        message: 'Cannot create performance record for inactive production line',
      });
      return;
    }

    // Create the performance record
    const performanceRecord = await prisma.performanceRecord.create({
      data: {
        workerId,
        productId,
        productionLineId,
        date,
        piecesMade,
        shift,
        timeTaken,
        errorRate,
      },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            cin: true,
            role: true,
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            code: true,
            category: true,
          }
        },
        productionLine: {
          select: {
            id: true,
            name: true,
            location: true,
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Performance record created successfully',
      performanceRecord,
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const updatePerformanceRecord = async (
  req: Request<IdParams, {}, UpdatePerformanceRecordInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const recordId = parseInt(req.params.id);
    const { 
      workerId, 
      productId, 
      productionLineId, 
      date, 
      piecesMade, 
      shift, 
      timeTaken, 
      errorRate 
    } = req.body;

    if (isNaN(recordId)) {
      res.status(400).json({
        error: 'INVALID_ID',
        message: 'Invalid performance record ID provided',
      });
      return;
    }

    // Check if performance record exists
    const existingRecord = await prisma.performanceRecord.findUnique({
      where: { id: recordId }
    });

    if (!existingRecord) {
      res.status(404).json({
        error: 'PERFORMANCE_RECORD_NOT_FOUND',
        message: 'Performance record not found',
      });
      return;
    }

    // Validate worker if provided
    if (workerId) {
      const worker = await prisma.worker.findUnique({
        where: { id: workerId }
      });

      if (!worker) {
        res.status(404).json({
          error: 'WORKER_NOT_FOUND',
          message: 'Worker not found',
        });
        return;
      }
    }

    // Validate product if provided
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId }
      });

      if (!product) {
        res.status(404).json({
          error: 'PRODUCT_NOT_FOUND',
          message: 'Product not found',
        });
        return;
      }

      if (!product.isActive) {
        res.status(400).json({
          error: 'PRODUCT_INACTIVE',
          message: 'Cannot assign to inactive product',
        });
        return;
      }
    }

    // Validate production line if provided
    if (productionLineId) {
      const productionLine = await prisma.productionLine.findUnique({
        where: { id: productionLineId }
      });

      if (!productionLine) {
        res.status(404).json({
          error: 'PRODUCTION_LINE_NOT_FOUND',
          message: 'Production line not found',
        });
        return;
      }

      if (!productionLine.isActive) {
        res.status(400).json({
          error: 'PRODUCTION_LINE_INACTIVE',
          message: 'Cannot assign to inactive production line',
        });
        return;
      }
    }

    // Build update data
    const updateData: any = {};
    if (workerId !== undefined) updateData.workerId = workerId;
    if (productId !== undefined) updateData.productId = productId;
    if (productionLineId !== undefined) updateData.productionLineId = productionLineId;
    if (date !== undefined) updateData.date = date;
    if (piecesMade !== undefined) updateData.piecesMade = piecesMade;
    if (shift !== undefined) updateData.shift = shift;
    if (timeTaken !== undefined) updateData.timeTaken = timeTaken;
    if (errorRate !== undefined) updateData.errorRate = errorRate;

    const updatedRecord = await prisma.performanceRecord.update({
      where: { id: recordId },
      data: updateData,
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            cin: true,
            role: true,
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            code: true,
            category: true,
          }
        },
        productionLine: {
          select: {
            id: true,
            name: true,
            location: true,
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Performance record updated successfully',
      performanceRecord: updatedRecord,
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const deletePerformanceRecord = async (
  req: Request<IdParams>,
  res: Response,
  next: NextFunction
) => {
  try {
    const recordId = parseInt(req.params.id);

    if (isNaN(recordId)) {
      res.status(400).json({
        error: 'INVALID_ID',
        message: 'Invalid performance record ID provided',
      });
      return;
    }

    const existingRecord = await prisma.performanceRecord.findUnique({
      where: { id: recordId }
    });

    if (!existingRecord) {
      res.status(404).json({
        error: 'PERFORMANCE_RECORD_NOT_FOUND',
        message: 'Performance record not found',
      });
      return;
    }

    await prisma.performanceRecord.delete({
      where: { id: recordId }
    });

    res.json({
      success: true,
      message: 'Performance record deleted successfully',
    });
    return;
  } catch (error) {
    next(error);
  }
};

// Get performance analytics
export const getPerformanceAnalytics = async (
  req: Request<{}, {}, {}, { 
    startDate?: string; 
    endDate?: string; 
    workerId?: string; 
    productionLineId?: string;
    groupBy?: 'worker' | 'product' | 'productionLine' | 'date';
  }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { startDate, endDate, workerId, productionLineId, groupBy = 'date' } = req.query;

    // Parse dates or default to current month if no date range provided
    let start: Date;
    let end: Date;

    if (startDate) {
      start = new Date(startDate);
      if (isNaN(start.getTime())) {
        res.status(400).json({
          error: 'INVALID_START_DATE',
          message: 'Invalid start date format',
        });
        return;
      }
    } else {
      start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    }

    if (endDate) {
      end = new Date(endDate);
      if (isNaN(end.getTime())) {
        res.status(400).json({
          error: 'INVALID_END_DATE',
          message: 'Invalid end date format',
        });
        return;
      }
    } else {
      end = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    }

    // Build where clause
    const where: any = {
      date: {
        gte: start,
        lte: end,
      }
    };

    if (workerId) where.workerId = parseInt(workerId);
    if (productionLineId) where.productionLineId = parseInt(productionLineId);

    // Get overall metrics
    const overallMetrics = await prisma.performanceRecord.aggregate({
      where,
      _sum: { piecesMade: true },
      _avg: { errorRate: true, timeTaken: true },
      _count: true,
    });

    // Get grouped analytics based on groupBy parameter
    let groupedData: any[] = [];

    switch (groupBy) {
      case 'worker':
        groupedData = await prisma.$queryRaw`
          SELECT 
            "workerId",
            SUM("piecesMade") as total_pieces,
            AVG("errorRate") as avg_error_rate,
            AVG("timeTaken") as avg_time_taken,
            COUNT(*) as record_count
          FROM "PerformanceRecord"
          WHERE date >= ${start} AND date <= ${end}
          ${workerId ? prisma.$queryRaw`AND "workerId" = ${parseInt(workerId)}` : prisma.$queryRaw``}
          ${productionLineId ? prisma.$queryRaw`AND "productionLineId" = ${parseInt(productionLineId)}` : prisma.$queryRaw``}
          GROUP BY "workerId"
        `;
        
        // Add worker details
        for (let i = 0; i < groupedData.length; i++) {
          const worker = await prisma.worker.findUnique({
            where: { id: groupedData[i].workerId },
            select: { id: true, name: true, cin: true, role: true }
          });
          groupedData[i].worker = worker;
        }
        break;

      case 'product':
        groupedData = await prisma.$queryRaw`
          SELECT 
            "productId",
            SUM("piecesMade") as total_pieces,
            AVG("errorRate") as avg_error_rate,
            AVG("timeTaken") as avg_time_taken,
            COUNT(*) as record_count
          FROM "PerformanceRecord"
          WHERE date >= ${start} AND date <= ${end}
          ${workerId ? prisma.$queryRaw`AND "workerId" = ${parseInt(workerId)}` : prisma.$queryRaw``}
          ${productionLineId ? prisma.$queryRaw`AND "productionLineId" = ${parseInt(productionLineId)}` : prisma.$queryRaw``}
          GROUP BY "productId"
        `;
        
        // Add product details
        for (const record of groupedData) {
          const product = await prisma.product.findUnique({
            where: { id: record.productid }, // Note: SQL returns lowercase column names
            select: { id: true, name: true, code: true, category: true }
          });
          record.product = product;
        }
        break;

      case 'productionLine':
        groupedData = await prisma.$queryRaw`
          SELECT 
            "productionLineId",
            SUM("piecesMade") as total_pieces,
            AVG("errorRate") as avg_error_rate,
            AVG("timeTaken") as avg_time_taken,
            COUNT(*) as record_count
          FROM "PerformanceRecord"
          WHERE date >= ${start} AND date <= ${end}
          ${workerId ? prisma.$queryRaw`AND "workerId" = ${parseInt(workerId)}` : prisma.$queryRaw``}
          ${productionLineId ? prisma.$queryRaw`AND "productionLineId" = ${parseInt(productionLineId)}` : prisma.$queryRaw``}
          GROUP BY "productionLineId"
        `;
        
        // Add production line details
        for (const record of groupedData) {
          const productionLine = await prisma.productionLine.findUnique({
            where: { id: record.productionlineid }, // Note: SQL returns lowercase column names
            select: { id: true, name: true, location: true }
          });
          record.productionLine = productionLine;
        }
        break;

      case 'date':
      default:
        // Group by date (daily analytics)
        const records = await prisma.performanceRecord.findMany({
          where,
          select: {
            date: true,
            piecesMade: true,
            errorRate: true,
            timeTaken: true,
          },
          orderBy: { date: 'asc' }
        });

        // Group by date manually
        // Group by date using SQL for better performance
        groupedData = await prisma.$queryRaw`
          SELECT 
            DATE(date) as date,
            SUM("piecesMade") as total_pieces,
            AVG("errorRate") as avg_error_rate,
            AVG("timeTaken") as avg_time_taken,
            COUNT(*) as record_count
          FROM "PerformanceRecord"
          WHERE date >= ${start} AND date <= ${end}
          ${workerId ? prisma.$queryRaw`AND "workerId" = ${parseInt(workerId)}` : prisma.$queryRaw``}
          ${productionLineId ? prisma.$queryRaw`AND "productionLineId" = ${parseInt(productionLineId)}` : prisma.$queryRaw``}
          GROUP BY DATE(date)
          ORDER BY date ASC
        `;

        // Transform raw SQL results to match the expected format
        groupedData = groupedData.map((record: any) => ({
          date: record.date,
          _sum: { piecesMade: Number(record.total_pieces) },
          _avg: { 
            errorRate: Number(record.avg_error_rate) || 0,
            timeTaken: Number(record.avg_time_taken) || 0,
          },
          _count: Number(record.record_count),
        }));
        break;
    }

    res.json({
      success: true,
      analytics: {
        overall: {
          totalPieces: overallMetrics._sum.piecesMade || 0,
          avgErrorRate: overallMetrics._avg.errorRate || 0,
          avgTimeTaken: overallMetrics._avg.timeTaken || 0,
          totalRecords: overallMetrics._count,
        },
        grouped: groupedData,
        groupBy,
        dateRange: { startDate: start, endDate: end },
      }
    });
    return;
  } catch (error) {
    next(error);
  }
};