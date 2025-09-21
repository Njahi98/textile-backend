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

router.get('/audit-logs', 
  requireAdminOrSuperAdmin,
  validateQuery(auditLogQuerySchema),
  getAuditLogs
);

router.get('/audit-logs/export', 
  requireAdminOrSuperAdmin,
  exportAuditLogs
);

router.get('/audit-logs/stats', 
  requireAdminOrSuperAdmin,
  validateQuery(auditStatsQuerySchema),
  getAuditStats
);

router.get('/audit-logs/:id', 
  requireAdminOrSuperAdmin,
  getAuditLogById
);

router.delete('/audit-logs/cleanup', 
  requireSuperAdmin,
  cleanupAuditLogs
);

export default router;