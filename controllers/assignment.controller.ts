import { Request, Response, NextFunction } from "express";
import { prisma } from '../server';
import { 
  CreateAssignmentInput, 
  UpdateAssignmentInput, 
  AssignmentQueryInput,
  CalendarQueryInput 
} from "../utils/validation";

interface IdParams {
  id: string;
}

export const getAllAssignments = async (
  req: Request<{}, {}, {}, AssignmentQueryInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = 1,
      limit = 100,
      ...filters
    } = req.query;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const {
      startDate,
      endDate,
      workerId,
      productionLineId,
      shift,
      position,
    } = filters;

    // Build where clause
    const where: any = {};

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    if (workerId) where.workerId = workerId;
    if (productionLineId) where.productionLineId = productionLineId;
    if (shift) where.shift = shift;
    if (position) where.position = { contains: position, mode: 'insensitive' };

    const [assignments, totalCount] = await Promise.all([
      prisma.assignment.findMany({
        where: {
          ...where,
          worker: { isDeleted: false },
          productionLine: { isDeleted: false },
        },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          date: true,
          position: true,
          shift: true,
          worker: {
            select: {
              id: true,
              name: true,
              cin: true,
              role: true,
            }
          },
          productionLine: {
            select: {
              id: true,
              name: true,
              location: true,
              isActive: true,
            }
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.assignment.count({ 
        where: {
          ...where,
          worker: { isDeleted: false },
          productionLine: { isDeleted: false },
        }
      })
    ]);

    res.status(200).json({
      success: true,
      assignments,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalCount,
        hasNext: skip + assignments.length < totalCount,
        hasPrev: pageNum > 1,
      }
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const getAssignmentById = async (
  req: Request<IdParams>,
  res: Response,
  next: NextFunction
) => {
  try {
    const assignmentId = parseInt(req.params.id);

    if (isNaN(assignmentId)) {
      res.status(400).json({
        error: 'INVALID_ID',
        message: req.t('assignment:errors.invalidId') ?? 'Invalid assignment ID provided',
      });
      return;
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
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
        productionLine: {
          select: {
            id: true,
            name: true,
            description: true,
            location: true,
            capacity: true,
            isActive: true,
          }
        }
      }
    });

    if (!assignment) {
      res.status(404).json({
        error: 'ASSIGNMENT_NOT_FOUND',
        message: req.t('assignment:errors.notFound') ?? 'Assignment not found',
      });
      return;
    }

    res.json({ success: true, assignment });
    return;
  } catch (error) {
    next(error);
  }
};

// Create single assignment with conflict detection
export const createAssignment = async (
  req: Request<{}, {}, CreateAssignmentInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { workerId, productionLineId, position, date, shift } = req.body;

    // Check if worker exists
    const worker = await prisma.worker.findUnique({
      where: { id: workerId }
    });

    if (!worker) {
      res.status(404).json({
        error: 'WORKER_NOT_FOUND',
        message: req.t('assignment:errors.workerNotFound') ?? 'Worker not found',
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
        message: req.t('assignment:errors.prodLineNotFound') ?? 'Production line not found',
      });
      return;
    }

    if (!productionLine.isActive) {
      res.status(400).json({
        error: 'PRODUCTION_LINE_INACTIVE',
        message: req.t('assignment:errors.prodLineInactive') ?? 'Cannot assign to inactive production line',
      });
      return;
    }

    // Check for conflicts (worker already assigned on same date and shift)
    const conflictingAssignment = await prisma.assignment.findFirst({
      where: {
        workerId,
        date: {
          gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
        },
        shift,
      },
      include: {
        productionLine: { select: { name: true } }
      }
    });

    if (conflictingAssignment) {
      res.status(409).json({
        error: 'ASSIGNMENT_CONFLICT',
          message: req.t('assignment:errors.assignmentConflict', { 
          productionLineName: conflictingAssignment.productionLine.name,
          date: date.toDateString(),
          shift: shift 
        }) ?? `Worker is already assigned to ${conflictingAssignment.productionLine.name} on ${date.toDateString()} for ${shift} shift`,
        conflictingAssignment: {
          id: conflictingAssignment.id,
          productionLineName: conflictingAssignment.productionLine.name,
          position: conflictingAssignment.position,
        }
      });
      return;
    }

    // Create the assignment
    const assignment = await prisma.assignment.create({
      data: {
        workerId,
        productionLineId,
        position,
        date,
        shift,
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
      message: req.t('assignment:messages.created') ?? 'Assignment created successfully',
      assignment,
    });
    return;
  } catch (error) {
    next(error);
  }
};

// Update assignment
export const updateAssignment = async (
  req: Request<IdParams, {}, UpdateAssignmentInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const assignmentId = parseInt(req.params.id);
    const { workerId, productionLineId, position, date, shift } = req.body;

    if (isNaN(assignmentId)) {
      res.status(400).json({
        error: 'INVALID_ID',
        message: req.t('assignment:errors.invalidId') ?? 'Invalid assignment ID provided',
      });
      return;
    }

    // Check if assignment exists
    const existingAssignment = await prisma.assignment.findUnique({
      where: { id: assignmentId }
    });

    if (!existingAssignment) {
      res.status(404).json({
        error: 'ASSIGNMENT_NOT_FOUND',
        message: req.t('assignment:errors.notFound') ?? 'Assignment not found',
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
          message: req.t('assignment:errors.workerNotFound') ?? 'Worker not found',
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
          message: req.t('assignment:errors.prodLineNotFound') ?? 'Production line not found',
        });
        return;
      }

      if (!productionLine.isActive) {
        res.status(400).json({
          error: 'PRODUCTION_LINE_INACTIVE',
          message: req.t('assignment:errors.prodLineInactive') ?? 'Cannot assign to inactive production line',
        });
        return;
      }
    }

    // Check for conflicts if worker, date, or shift is being changed
    if (workerId || date || shift) {
      const finalWorkerId = workerId || existingAssignment.workerId;
      const finalDate = date || existingAssignment.date;
      const finalShift = shift || existingAssignment.shift;

      const conflictingAssignment = await prisma.assignment.findFirst({
        where: {
          workerId: finalWorkerId,
          date: {
            gte: new Date(finalDate.getFullYear(), finalDate.getMonth(), finalDate.getDate()),
            lt: new Date(finalDate.getFullYear(), finalDate.getMonth(), finalDate.getDate() + 1),
          },
          shift: finalShift,
          NOT: { id: assignmentId }, // Exclude current assignment
        },
        include: {
          productionLine: { select: { name: true } }
        }
      });

      if (conflictingAssignment) {
        res.status(409).json({
          error: 'ASSIGNMENT_CONFLICT',
message: req.t('assignment:errors.assignmentConflict', { 
            productionLineName: conflictingAssignment.productionLine.name,
            date: finalDate.toDateString(),
            shift: finalShift 
          }) ?? `Worker is already assigned to ${conflictingAssignment.productionLine.name} on ${finalDate.toDateString()} for ${finalShift} shift`,
        conflictingAssignment: {
            id: conflictingAssignment.id,
            productionLineName: conflictingAssignment.productionLine.name,
            position: conflictingAssignment.position,
          }
        });
        return;
      }
    }

    // Build update data
    const updateData: any = {};
    if (workerId !== undefined) updateData.workerId = workerId;
    if (productionLineId !== undefined) updateData.productionLineId = productionLineId;
    if (position !== undefined) updateData.position = position;
    if (date !== undefined) updateData.date = date;
    if (shift !== undefined) updateData.shift = shift;

    const updatedAssignment = await prisma.assignment.update({
      where: { id: assignmentId },
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
      message: req.t('assignment:messages.updated') ?? 'Assignment updated successfully',
      assignment: updatedAssignment,
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const deleteAssignment = async (
  req: Request<IdParams>,
  res: Response,
  next: NextFunction
) => {
  try {
    const assignmentId = parseInt(req.params.id);

    if (isNaN(assignmentId)) {
      res.status(400).json({
        error: 'INVALID_ID',
        message: req.t('assignment:errors.invalidId') ?? 'Invalid assignment ID provided',
      });
      return;
    }

    const existingAssignment = await prisma.assignment.findUnique({
      where: { id: assignmentId }
    });

    if (!existingAssignment) {
      res.status(404).json({
        error: 'ASSIGNMENT_NOT_FOUND',
        message: req.t('assignment:errors.notFound') ?? 'Assignment not found',
      });
      return;
    }

    await prisma.assignment.delete({
      where: { id: assignmentId }
    });

    res.json({
      success: true,
      message: req.t('assignment:messages.deleted') ?? 'Assignment deleted successfully',
    });
    return;
  } catch (error) {
    next(error);
  }
};

// Get calendar view of assignments
export const getAssignmentsCalendar = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
     const { year, month, workerId, productionLineId } =
      (req as Request & { validatedQuery: CalendarQueryInput }).validatedQuery;


    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Build where clause
    const where: any = {
      date: {
        gte: startDate,
        lte: endDate,
      }
    };

    if (workerId) where.workerId = workerId;
    if (productionLineId) where.productionLineId = productionLineId;

    const assignments = await prisma.assignment.findMany({
      where:{worker: { isDeleted: false }, productionLine: { isDeleted: false }, ...where},
      select: {
        id: true,
        date: true,
        position: true,
        shift: true,
        worker: {
          select: {
            id: true,
            name: true,
            cin: true,
            role: true,
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
      orderBy: [
        { date: 'asc' },
        { shift: 'asc' },
      ]
    });

    // Group assignments by date
    const calendar: Record<string, any[]> = {};

    assignments.forEach(assignment => {
      if (!assignment.date) return; // Guard for undefined date
      const dateKey = assignment.date.toISOString().split('T')[0] as string; // YYYY-MM-DD format
      if (!calendar[dateKey]) {
        calendar[dateKey] = [];
      }
      calendar[dateKey].push(assignment);
    });

    res.json({
      success: true,
      calendar,
      summary: {
        year,
        month,
        totalAssignments: assignments.length,
        daysWithAssignments: Object.keys(calendar).length,
      }
    });
    return;
  } catch (error) {
    next(error);
  }
};
