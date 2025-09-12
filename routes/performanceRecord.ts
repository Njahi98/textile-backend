import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { isAuthenticated, requireAdmin } from '../middleware/isAuthenticated';
import { validate } from '../middleware/validation';
import { 
  createPerformanceRecordSchema, 
  updatePerformanceRecordSchema 
} from '../utils/validation';
import {
  getAllPerformanceRecords,
  getPerformanceRecordById,
  createPerformanceRecord,
  updatePerformanceRecord,
  deletePerformanceRecord,
  getPerformanceAnalytics,
} from '../controllers/performanceRecord.controller';

// Convert controller functions to express request handlers
const withRequestHandler = (fn: Function) => (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise.resolve(fn(req, res, next)).catch(next);

const router = express.Router();

router.use(isAuthenticated);

router.get('/performance/', withRequestHandler(getAllPerformanceRecords));
router.get('/performance/analytics', withRequestHandler(getPerformanceAnalytics));
router.get('/performance/:id', withRequestHandler(getPerformanceRecordById));
router.post('/performance/', validate(createPerformanceRecordSchema), withRequestHandler(createPerformanceRecord));
router.put('/performance/:id', validate(updatePerformanceRecordSchema), withRequestHandler(updatePerformanceRecord));
router.delete('/performance/:id', withRequestHandler(deletePerformanceRecord));

export default router;