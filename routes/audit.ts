import express from 'express';
import { isAuthenticated, requireAdminOrSuperAdmin, requireSuperAdmin } from '../middleware/isAuthenticated';
import { validateQuery } from '../middleware/validation';
import {
  getAuditLogs,
  getAuditLogById,
  getAuditStats,
  exportAuditLogs,
  cleanupAuditLogs,
} from '../controllers/auditLog.controller';
import {
  auditLogQuerySchema,
  auditStatsQuerySchema,
  auditCleanupQuerySchema,
} from '../utils/validation';

const router = express.Router();

router.use(isAuthenticated);

router.get('/', 
  requireAdminOrSuperAdmin,
  validateQuery(auditLogQuerySchema),
  getAuditLogs
);

router.get('/export', 
  requireAdminOrSuperAdmin,
  exportAuditLogs
);

router.get('/stats', 
  requireAdminOrSuperAdmin,
  validateQuery(auditStatsQuerySchema),
  getAuditStats
);

router.get('/:id', 
  requireAdminOrSuperAdmin,
  getAuditLogById
);

router.delete('/cleanup', 
  requireSuperAdmin,
  cleanupAuditLogs
);

export default router;