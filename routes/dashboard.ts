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

router.get('/stats', getDashboardStats);

router.get('/production-metrics', getProductionMetrics);

router.get('/worker-performance', getWorkerPerformance);

router.get('/recent-activities', getRecentActivities);

router.get('/production-trends', getProductionTrends);

export default router;