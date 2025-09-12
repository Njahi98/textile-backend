import express from 'express';
import { isAuthenticated } from '../middleware/isAuthenticated';
import {
  getDashboardStats,
  getProductionMetrics,
  getWorkerPerformance,
  getRecentActivities,
  getProductionTrends
} from '../controllers/dashboard.controller';

const router = express.Router();

router.use(isAuthenticated);

router.get('/dashboard/stats', getDashboardStats);

router.get('/dashboard/production-metrics', getProductionMetrics);

router.get('/dashboard/worker-performance', getWorkerPerformance);

router.get('/dashboard/recent-activities', getRecentActivities);

router.get('/dashboard/production-trends', getProductionTrends);

export default router;