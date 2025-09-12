import express from 'express';
import { isAuthenticated, requireAdmin } from '../middleware/isAuthenticated';
import {
  getAllProductionLines,
  getProductionLineById,
  createProductionLine,
  updateProductionLine,
  toggleProductionLineStatus,
  deleteProductionLine,
} from '../controllers/productionLine.controller';
import { validate } from '../middleware/validation';
import { createProductionLineSchema, updateProductionLineSchema } from '../utils/validation';

const router = express.Router();

router.use(isAuthenticated);

router.get('/production-lines/', getAllProductionLines);
router.get('/production-lines/:id', getProductionLineById);
router.post('/production-lines/', validate(createProductionLineSchema), createProductionLine);
router.put('/production-lines/:id', validate(updateProductionLineSchema), updateProductionLine);
router.patch('/production-lines/:id/toggle', toggleProductionLineStatus);
router.delete('/production-lines/:id', deleteProductionLine);

export default router; 