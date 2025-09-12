import { Router } from 'express';
import { getAIInsights } from '../controllers/insights.controller';
import { isAuthenticated } from '../middleware/isAuthenticated';
import { aiInsightsRateLimit } from '../middleware/rateLimiter';

const router = Router();

router.get(
  '/insights/',
  isAuthenticated,
  aiInsightsRateLimit,
  getAIInsights
);

export default router;