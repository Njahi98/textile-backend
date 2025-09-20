import { Request, Response, NextFunction } from 'express';
import { prisma } from '../server';

export const getAllProductionLines = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const productionLines = await prisma.productionLine.findMany({
      where: { isDeleted: false },
      include: {
        assignments: {
          include: { worker: true },
        },
        performanceRecords: {
          include: { product: true },
          orderBy: { date: 'desc' },
          take: 10,
        },
      },
      orderBy: { name: 'asc' },
    });

    // For each line, calculate daily output and performance metrics
    const linesWithMetrics = await Promise.all(
      productionLines.map(async (line) => {
        // Count assignments for today (only from non-deleted workers)
        const currentAssignments = await prisma.assignment.count({
          where: {
            productionLineId: line.id,
            date: {
              gte: today,
              lt: tomorrow,
            },
            worker: { isDeleted: false },
          },
        });
        // Calculate daily output (sum of piecesMade for today, only from non-deleted workers and products)
        const dailyOutput = await prisma.performanceRecord.aggregate({
          _sum: { piecesMade: true },
          where: {
            productionLineId: line.id,
            date: {
              gte: today,
              lt: tomorrow,
            },
            worker: { isDeleted: false },
            product: { isDeleted: false },
          },
        });
        // Performance metrics: avg errorRate, avg timeTaken for today (only from non-deleted workers and products)
        const perfMetrics = await prisma.performanceRecord.aggregate({
          _avg: { errorRate: true, timeTaken: true },
          where: {
            productionLineId: line.id,
            date: {
              gte: today,
              lt: tomorrow,
            },
            worker: { isDeleted: false },
            product: { isDeleted: false },
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
      where: { id, isDeleted: false },
      include: {
        assignments: {
          include: { worker: true },
          orderBy: { date: 'desc' },
          take: 50,
        },
        performanceRecords: {
          include: { product: true, worker: true },
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
        worker: { isDeleted: false },
      },
    });
    const dailyOutput = await prisma.performanceRecord.aggregate({
      _sum: { piecesMade: true },
      where: {
        productionLineId: id,
        date: {
          gte: today,
          lt: tomorrow,
        },
        worker: { isDeleted: false },
        product: { isDeleted: false },
      },
    });
    const perfMetrics = await prisma.performanceRecord.aggregate({
      _avg: { errorRate: true, timeTaken: true },
      where: {
        productionLineId: id,
        date: {
          gte: today,
          lt: tomorrow,
        },
        worker: { isDeleted: false },
        product: { isDeleted: false },
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
    
    const existingLine = await prisma.productionLine.findFirst({
      where: { name },
    });

    if (existingLine) {
      res.status(409).json({
        error: 'NAME_EXISTS',
        message: 'A production line with this name already exists'
      });
      return;
    }

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

    const existingLine = await prisma.productionLine.findUnique({
      where: { id},
      select: { name: true }
    });

    if (!existingLine) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Production line not found' });
      return;
    }

    const { name, description, capacity, targetOutput, location, isActive } = req.body;

    // Check if production line name already exists (if being updated)
    if (name && name !== existingLine.name) {
      const nameExists = await prisma.productionLine.findFirst({
        where: { name, isDeleted: false },
      });

      if (nameExists) {
        res.status(409).json({
          error: 'NAME_EXISTS',
          message: 'A production line with this name already exists'
        });
        return;
      }
    }

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

      const existingLine = await prisma.productionLine.findUnique({
        where: { id },
        select: { name: true }
      });

    if (!existingLine) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Production line not found' });
      return;
    }

    await prisma.productionLine.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
        name: `deleted_${existingLine.name}_${new Date().toISOString()}`,
      }
    });

    res.json({ success: true, message: 'Production line deleted successfully' });
  } catch (error) {
    next(error);
  }
}; 