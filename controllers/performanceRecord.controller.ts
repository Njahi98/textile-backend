import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../server';
import { CreatePerformanceRecordInput, PerformanceRecordQueryInput, UpdatePerformanceRecordInput } from '../utils/validation';

interface IdParams {
  id: string;
}


export const getAllPerformanceRecords = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = 1,
      limit = 50,
      startDate,
      endDate,
      workerId,
      productId,
      productionLineId,
      shift,
      search,
    } 
    = (req as Request & { validatedQuery: PerformanceRecordQueryInput}).validatedQuery;

    const pageNum = Number(page) || 1;
    const limitNum = Math.min(Number(limit) || 50, 100);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {
      worker: { isDeleted: false },
      product: { isDeleted: false },
      productionLine: { isDeleted: false },
    };

    // Date range filtering
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = startDate;
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        where.date.lte = endOfDay;
      }
    }

    // Filter by specific IDs
    if (workerId) where.workerId = Number(workerId);
    if (productId) where.productId = Number(productId);
    if (productionLineId) where.productionLineId = Number(productionLineId);
    if (shift) where.shift = shift;

    // Search functionality
    if (search && typeof search === 'string' && search.length >= 2) {
      where.OR = [
        {
          worker: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          worker: {
            cin: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          product: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          product: {
            code: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          productionLine: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

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
      },
      filters: {
        startDate,
        endDate,
        workerId,
        productId,
        productionLineId,
        shift,
        search,
      },
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
        message: req.t('performance:errors.invalidId') ?? 'Invalid performance record ID provided',
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
        message: req.t('performance:errors.notFound') ?? 'Performance record not found',
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
        message: req.t('performance:errors.workerNotFound') ?? 'Worker not found',
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
        message: req.t('performance:errors.productNotFound') ?? 'Product not found',
      });
      return;
    }

    if (!product.isActive) {
      res.status(400).json({
        error: 'PRODUCT_INACTIVE',
        message: req.t('performance:errors.productInactive') ?? 'Cannot create performance record for inactive product',
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
        message: req.t('performance:errors.prodLineNotFound') ?? 'Production line not found',
      });
      return;
    }

    if (!productionLine.isActive) {
      res.status(400).json({
        error: 'PRODUCTION_LINE_INACTIVE',
        message: req.t('performance:errors.prodLineInactive') ?? 'Cannot create performance record for inactive production line',
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
      message: req.t('performance:messages.created') ?? 'Performance record created successfully',
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
        message: req.t('performance:errors.invalidId') ?? 'Invalid performance record ID provided',
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
          message: req.t('performance:errors.notFound') ?? 'Performance record not found',
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
          message: req.t('performance:errors.workerNotFound') ?? 'Worker not found',
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
          message: req.t('performance:errors.productNotFound') ?? 'Product not found',
        });
        return;
      }

      if (!product.isActive) {
        res.status(400).json({
          error: 'PRODUCT_INACTIVE',
          message: req.t('performance:errors.assignInactiveProduct') ?? 'Cannot assign to inactive product',
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
          message: req.t('performance:errors.prodLineNotFound') ?? 'Production line not found',
        });
        return;
      }

      if (!productionLine.isActive) {
        res.status(400).json({
          error: 'PRODUCTION_LINE_INACTIVE',
          message: req.t('performance:errors.assignInactiveProdLine') ?? 'Cannot assign to inactive production line',
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
      message: req.t('performance:messages.updated') ?? 'Performance record updated successfully',
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
        message: req.t('performance:errors.invalidId') ?? 'Invalid performance record ID provided',
      });
      return;
    }

    const existingRecord = await prisma.performanceRecord.findUnique({
      where: { id: recordId }
    });

    if (!existingRecord) {
      res.status(404).json({
        error: 'PERFORMANCE_RECORD_NOT_FOUND',
        message: req.t('performance:errors.notFound') ?? 'Performance record not found',
      });
      return;
    }

    await prisma.performanceRecord.delete({
      where: { id: recordId }
    });

    res.json({
      success: true,
      message: req.t('performance:messages.deleted') ?? 'Performance record deleted successfully',
    });
    return;
  } catch (error) {
    next(error);
  }
};

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
          message: req.t('performance:errors.invalidStartDate') ?? 'Invalid start date format',
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
          message: req.t('performance:errors.invalidEndDate') ?? 'Invalid end date format',
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
      },
      worker: { isDeleted: false },
      product: { isDeleted: false },
      productionLine: { isDeleted: false },
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
      groupedData = await prisma.performanceRecord.groupBy({
        by: ['workerId'] as const,
        where,
        _sum: { piecesMade: true },
        _avg: { errorRate: true, timeTaken: true },
        _count: true,
      } as any);

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
        groupedData = await prisma.performanceRecord.groupBy({
          by: ['productId'] as const,
          where,
          _sum: { piecesMade: true },
          _avg: { errorRate: true, timeTaken: true },
          _count: true,
        } as any);

        // Add product details
        for (let i = 0; i < groupedData.length; i++) {
          const product = await prisma.product.findUnique({
            where: { id: groupedData[i].productId },
            select: { id: true, name: true, code: true, category: true }
          });
          groupedData[i].product = product;
        }
        break;

      case 'productionLine':
        groupedData = await prisma.performanceRecord.groupBy({
          by: ['productionLineId'] as const,
          where,
          _sum: { piecesMade: true },
          _avg: { errorRate: true, timeTaken: true },
          _count: true,
        } as any);

        // Add production line details
        for (let i = 0; i < groupedData.length; i++) {
          const productionLine = await prisma.productionLine.findUnique({
            where: { id: groupedData[i].productionLineId },
            select: { id: true, name: true, location: true, capacity: true }
          });
          groupedData[i].productionLine = productionLine;
        }
        break;

      case 'date':
      default:
      groupedData = await prisma.performanceRecord.groupBy({
        by: ['date'] as const,
        where,
        _sum: { piecesMade: true },
        _avg: { errorRate: true, timeTaken: true },
        _count: true,
        orderBy: { date: 'asc' },
      } as any);
        break;
    }

    // Transform the data to ensure consistent format
    const transformedGroupedData = groupedData.map((item: any) => {
      // Convert BigInt values to regular numbers if they exist
      const transformed: any = {
        ...item,
      };

      // Handle _sum, _avg, _count fields
      if (item._sum) {
        transformed._sum = {
          piecesMade: Number(item._sum.piecesMade) || 0
        };
      }
      if (item._avg) {
        transformed._avg = {
          errorRate: Number(item._avg.errorRate) || 0,
          timeTaken: Number(item._avg.timeTaken) || 0
        };
      }
      if (item._count !== undefined) {
        transformed._count = Number(item._count) || 0;
      }

      return transformed;
    });

    res.json({
      success: true,
      analytics: {
        overall: {
          totalPieces: Number(overallMetrics._sum.piecesMade) || 0,
          avgErrorRate: Number(overallMetrics._avg.errorRate) || 0,
          avgTimeTaken: Number(overallMetrics._avg.timeTaken) || 0,
          totalRecords: Number(overallMetrics._count),
        },
        grouped: transformedGroupedData,
        groupBy,
        dateRange: { startDate: start, endDate: end },
      }
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const exportPerformanceAnalyticsCsv = async (
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

    
    let start: Date;
    let end: Date;
    if (startDate) {
      start = new Date(startDate);
      if (isNaN(start.getTime())) {
        res.status(400).json({ error: 'INVALID_START_DATE' });
        return;
      }
    } else {
      start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    }
    if (endDate) {
      end = new Date(endDate);
      if (isNaN(end.getTime())) {
        res.status(400).json({ error: 'INVALID_END_DATE' });
        return;
      }
    } else {
      end = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    }

    const where: any = {
      date: { gte: start, lte: end },
      worker: { isDeleted: false },
      product: { isDeleted: false },
      productionLine: { isDeleted: false },
    };
    if (workerId) where.workerId = parseInt(workerId);
    if (productionLineId) where.productionLineId = parseInt(productionLineId);

    const overallMetrics = await prisma.performanceRecord.aggregate({
      where,
      _sum: { piecesMade: true },
      _avg: { errorRate: true, timeTaken: true },
      _count: true,
    });

    let groupedData: any[] = [];
    switch (groupBy) {
      case 'worker':
        groupedData = await prisma.performanceRecord.groupBy({
          by: ['workerId'] as const,
          where,
          _sum: { piecesMade: true },
          _avg: { errorRate: true, timeTaken: true },
          _count: true,
        } as any);
        for (let i = 0; i < groupedData.length; i++) {
          groupedData[i].worker = await prisma.worker.findUnique({
            where: { id: groupedData[i].workerId },
            select: { id: true, name: true }
          });
        }
        break;
      case 'product':
        groupedData = await prisma.performanceRecord.groupBy({
          by: ['productId'] as const,
          where,
          _sum: { piecesMade: true },
          _avg: { errorRate: true, timeTaken: true },
          _count: true,
        } as any);
        for (let i = 0; i < groupedData.length; i++) {
          groupedData[i].product = await prisma.product.findUnique({
            where: { id: groupedData[i].productId },
            select: { id: true, name: true, code: true }
          });
        }
        break;
      case 'productionLine':
        groupedData = await prisma.performanceRecord.groupBy({
          by: ['productionLineId'] as const,
          where,
          _sum: { piecesMade: true },
          _avg: { errorRate: true, timeTaken: true },
          _count: true,
        } as any);
        for (let i = 0; i < groupedData.length; i++) {
          groupedData[i].productionLine = await prisma.productionLine.findUnique({
            where: { id: groupedData[i].productionLineId },
            select: { id: true, name: true, location: true, capacity: true }
          });
        }
        break;
      case 'date':
      default:
        groupedData = await prisma.performanceRecord.groupBy({
          by: ['date'] as const,
          where,
          _sum: { piecesMade: true },
          _avg: { errorRate: true, timeTaken: true },
          _count: true,
          orderBy: { date: 'asc' },
        } as any);
        break;
    }

    
    const transformed = groupedData.map((item: any) => ({
      ...item,
      _sum: { piecesMade: Number(item._sum?.piecesMade) || 0 },
      _avg: { errorRate: Number(item._avg?.errorRate) || 0, timeTaken: Number(item._avg?.timeTaken) || 0 },
      _count: Number(item._count) || 0,
    }));

    // Build CSV
    const escapeCSV = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
    const lines: string[] = [];
    const now = new Date();
    lines.push(escapeCSV('PERFORMANCE ANALYTICS REPORT'));
    lines.push(escapeCSV(`Generated on: ${now.toISOString()}`));
    lines.push(escapeCSV(`Date Range: ${start.toISOString().slice(0,10)} to ${end.toISOString().slice(0,10)}`));
    lines.push(escapeCSV(`Analysis grouped by: ${groupBy}`));
    lines.push('');
    lines.push([escapeCSV('Metric'), escapeCSV('Value'), escapeCSV('Description')].join(','));
    lines.push([escapeCSV('Total Pieces Produced'), escapeCSV(Number(overallMetrics._sum.piecesMade) || 0), escapeCSV('Total production output across all records')].join(','));
    lines.push([escapeCSV('Average Error Rate'), escapeCSV((Number(overallMetrics._avg.errorRate) || 0).toFixed(2) + '%'), escapeCSV('Quality metric - lower is better')].join(','));
    lines.push([escapeCSV('Average Time Taken'), escapeCSV((Number(overallMetrics._avg.timeTaken) || 0).toFixed(1) + ' hours'), escapeCSV('Efficiency metric - time per production cycle')].join(','));
    lines.push([escapeCSV('Total Records Analyzed'), escapeCSV(Number(overallMetrics._count) || 0), escapeCSV('Number of data points in this analysis')].join(','));
    lines.push('');

    // Detailed section header
    const headers: string[] = ['Rank'];
    if (groupBy === 'date') headers.push('Date');
    else {
      headers.push('ID', 'Name');
      if (groupBy === 'product') headers.push('Product Code');
      if (groupBy === 'productionLine') headers.push('Location');
    }
    headers.push('Pieces Produced','Error Rate (%)','Time Taken (hours)','Records Count');
    lines.push(headers.map(escapeCSV).join(','));

    const sorted = [...transformed].sort((a, b) => (b._sum.piecesMade - a._sum.piecesMade));
    sorted.forEach((item, idx) => {
      const row: (string|number)[] = [idx + 1];
      if (groupBy === 'date') {
        row.push(new Date(item.date).toISOString().slice(0,10));
      } else if (groupBy === 'worker') {
        row.push(item.workerId || '','' + (item.worker?.name || `Worker #${item.workerId || 'Unknown'}`));
      } else if (groupBy === 'product') {
        row.push(item.productId || '','' + (item.product?.name || `Product #${item.productId || 'Unknown'}`), item.product?.code || '');
      } else if (groupBy === 'productionLine') {
        row.push(item.productionLineId || '','' + (item.productionLine?.name || `Line #${item.productionLineId || 'Unknown'}`), item.productionLine?.location || '');
      }
      row.push(
        item._sum.piecesMade,
        (item._avg.errorRate || 0).toFixed(2),
        (item._avg.timeTaken || 0).toFixed(1),
        item._count
      );
      lines.push(row.map(escapeCSV).join(','));
    });

    const csv = lines.join('\n');

    // Audit log export
    try {
      const { AuditResource } = await import('../generated/prisma');
      const { default: AuditService } = await import('../utils/auditService');
      await AuditService.logImportExport('EXPORT', AuditResource.PERFORMANCE_RECORD, (req as any).user?.id, req, {
        exportType: 'performance_analytics',
        groupBy,
        dataPoints: transformed.length,
        startDate: start,
        endDate: end,
        workerId: workerId ? Number(workerId) : undefined,
        productionLineId: productionLineId ? Number(productionLineId) : undefined,
      }, `Exported performance analytics (${groupBy})`);
    } catch {}

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=performance-analytics-${new Date().toISOString().slice(0,10)}.csv`);
    res.status(200).send(csv);
    return;
  } catch (error) {
    next(error);
  }
};