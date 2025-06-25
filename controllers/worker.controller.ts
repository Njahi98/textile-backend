import { Request, Response, NextFunction } from 'express';
import { truncate } from 'fs';
import { prisma } from 'server';

interface UpdateWorkerData {
  role?: string;
  name?: string;
}

interface idParams {
  id: string;
}

export const getAllWorkers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const workers = await prisma.worker.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            assignments: true,
            performanceRecords: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    res.json({ success: true, workers });
    return;
  } catch (error) {
    next(error);
  }
};

export const getWorkerById = async (
  req: Request<idParams>,
  res: Response,
  next: NextFunction
) => {
  try {
    const workerId = parseInt(req.params.id);

    if (isNaN(workerId)) {
      res.status(400).json({
        error: 'INVALID_ID',
        message: 'Invalid worker ID provided',
      });
      return;
    }

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            assignments: true,
            performanceRecords: true,
          },
        },
        assignments: {
          include: {
            productionLine: true,
          },
          orderBy: { date: 'desc' },
          take: 20,
        },
        performanceRecords: {
          orderBy: { date: 'desc' },
          take: 50,
        },
      },
    });
    

    if (!worker) {
      res.status(404).json({
        error: 'WORKER_NOT_FOUND',
        message: 'Worker not found',
      });
      return;
    }

    res.json({ success: true, worker });
    return;
  } catch (error) {
    next(error);
  }
};

export const createWorker = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, role } = req.body;
    const worker = await prisma.worker.create({
      data: {
        name,
        role,
      },
      select: {
        id: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.status(201).json({
      success: true,
      message: 'Worker created successfully',
      worker,
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const updateWorker = async (
  req: Request<{ id: string }, {}, UpdateWorkerData>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const workerId = parseInt(req.params.id);
    if (isNaN(workerId)) {
      res.status(400).json({
        error: 'INVALID_ID',
        message: 'Invalid worker ID provided',
      });
      return;
    }
    const { name, role } = req.body;
    const existingWorker = await prisma.worker.findUnique({
      where: {
        id: workerId,
      },
    });
    if (!existingWorker) {
      res.status(404).json({
        error: 'WORKER_NOT_FOUND',
        message: 'Worker not found',
      });
      return;
    }
    const updatedData: any = {};
    if (name) updatedData.name = name;
    if (role) updatedData.role = role;

    const updatedWorker = await prisma.worker.update({
      where: { id: workerId },
      data: updatedData,
      select: {
        id: true,
        name: true,
        role: true,
      },
    });
    res.json({
      success: true,
      message: 'worker updated successfully',
      worker: updatedWorker,
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const deleteWorker = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const workerId = parseInt(req.params.id);
    if (isNaN(workerId)) {
      res.status(400).json({
        error: 'INVALID_ID',
        message: 'Invalid worker ID provided',
      });
      return;
    }
    const existingWorker = await prisma.worker.findUnique({
      where: { id: workerId },
    });
    if (!existingWorker) {
      res.status(404).json({
        error: 'WORKER_NOT_FOUND',
        message: 'Worker not found',
      });
      return;
    }
    await prisma.worker.delete({
      where: { id: workerId },
    });

    res.json({
      success: true,
      message: 'Worker deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
