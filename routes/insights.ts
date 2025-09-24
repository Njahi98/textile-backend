import { Router } from 'express';
import { getAIInsights } from '../controllers/insights.controller';
import { isAuthenticated } from '../middleware/isAuthenticated';
import { aiInsightsRateLimit } from '../middleware/rateLimiter';
import { validateQuery } from '../middleware/validation';
import { InsightsQueryInputSchema } from '../utils/validation';

const router = Router();

router.get(
  '/insights/',
  isAuthenticated,
  aiInsightsRateLimit,
  validateQuery(InsightsQueryInputSchema),
  getAIInsights
);

export default router;