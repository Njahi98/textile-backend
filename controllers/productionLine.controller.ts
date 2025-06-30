import { Request, Response, NextFunction } from 'express';
import { prisma } from '../server';

// production lines with capacity, current assignments, daily output, and performance metrics
export const getAllProductionLines = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const productionLines = await prisma.productionLine.findMany({
      include: {
        assignments: {
          include: { worker: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // For each line, calculate daily output and performance metrics
    const linesWithMetrics = await Promise.all(
      productionLines.map(async (line) => {
        // Count assignments for today
        const currentAssignments = await prisma.assignment.count({
          where: {
            productionLineId: line.id,
            date: {
              gte: today,
              lt: tomorrow,
            },
          },
        });
        // Calculate daily output (sum of piecesMade for today)
        const dailyOutput = await prisma.performanceRecord.aggregate({
          _sum: { piecesMade: true },
          where: {
            worker: {
              assignments: {
                some: {
                  productionLineId: line.id,
                  date: {
                    gte: today,
                    lt: tomorrow,
                  },
                },
              },
            },
            date: {
              gte: today,
              lt: tomorrow,
            },
          },
        });
        // Performance metrics: avg errorRate, avg timeTaken for today
        const perfMetrics = await prisma.performanceRecord.aggregate({
          _avg: { errorRate: true, timeTaken: true },
          where: {
            worker: {
              assignments: {
                some: {
                  productionLineId: line.id,
                  date: {
                    gte: today,
                    lt: tomorrow,
                  },
                },
              },
            },
            date: {
              gte: today,
              lt: tomorrow,
            },
          },
        });
        return {
          ...line,
          currentAssignments,
          dailyOutput: dailyOutput._sum.piecesMade || 0,
          performance: {
            avgErrorRate: perfMetrics._avg.errorRate || 0,
            avgTimeTaken: perfMetrics._avg.timeTaken || 0,
          },
        };
      })
    );
    res.json({ success: true, productionLines: linesWithMetrics });
  } catch (error) {
    next(error);
  }
};

export const getProductionLineById = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Invalid production line ID' });
      return;
    }
    const line = await prisma.productionLine.findUnique({
      where: { id },
      include: {
        assignments: {
          include: { worker: true },
          orderBy: { date: 'desc' },
          take: 50,
        },
      },
    });
    if (!line) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Production line not found' });
      return;
    }
    // Metrics for this line (today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const currentAssignments = await prisma.assignment.count({
      where: {
        productionLineId: id,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });
    const dailyOutput = await prisma.performanceRecord.aggregate({
      _sum: { piecesMade: true },
      where: {
        worker: {
          assignments: {
            some: {
              productionLineId: id,
              date: {
                gte: today,
                lt: tomorrow,
              },
            },
          },
        },
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });
    const perfMetrics = await prisma.performanceRecord.aggregate({
      _avg: { errorRate: true, timeTaken: true },
      where: {
        worker: {
          assignments: {
            some: {
              productionLineId: id,
              date: {
                gte: today,
                lt: tomorrow,
              },
            },
          },
        },
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });
    res.json({
      success: true,
      productionLine: {
        ...line,
        currentAssignments,
        dailyOutput: dailyOutput._sum.piecesMade || 0,
        performance: {
          avgErrorRate: perfMetrics._avg.errorRate || 0,
          avgTimeTaken: perfMetrics._avg.timeTaken || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createProductionLine = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, capacity, targetOutput, location } = req.body;
    const productionLine = await prisma.productionLine.create({
      data: {
        name,
        description: description || null,
        capacity: capacity ?? null,
        targetOutput: targetOutput ?? null,
        location: location || null,
      },
    });
    res.status(201).json({ success: true, message: 'Production line created', productionLine });
  } catch (error) {
    next(error);
  }
};

export const updateProductionLine = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Invalid production line ID' });
      return;
    }
    const { name, description, capacity, targetOutput, location, isActive } = req.body;
    const productionLine = await prisma.productionLine.update({
      where: { id },
      data: {
        name,
        description,
        capacity,
        targetOutput,
        location,
        isActive,
      },
    });
    res.json({ success: true, message: 'Production line updated', productionLine });
  } catch (error) {
    next(error);
  }
};

export const toggleProductionLineStatus = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Invalid production line ID' });
      return;
    }
    const line = await prisma.productionLine.findUnique({ where: { id } });
    if (!line) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Production line not found' });
      return;
    }
    const updated = await prisma.productionLine.update({
      where: { id },
      data: { isActive: !line.isActive },
    });
    res.json({ success: true, message: `Production line is now ${updated.isActive ? 'active' : 'inactive'}`, productionLine: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteProductionLine = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Invalid production line ID' });
      return;
    }
    await prisma.productionLine.delete({ where: { id } });
    res.json({ success: true, message: 'Production line deleted' });
  } catch (error) {
    next(error);
  }
}; 