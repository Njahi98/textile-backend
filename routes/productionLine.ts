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

router.get('/', getAllProductionLines);
router.get('/:id', getProductionLineById);
router.post('/', validate(createProductionLineSchema), createProductionLine);
router.put('/:id', validate(updateProductionLineSchema), updateProductionLine);
router.patch('/:id/toggle', toggleProductionLineStatus);
router.delete('/:id', deleteProductionLine);

export default router; 