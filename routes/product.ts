import express from 'express';
import { isAuthenticated, requireAdmin } from '../middleware/isAuthenticated';
import { validate } from '../middleware/validation';
import { createProductSchema, updateProductSchema } from '../utils/validation';
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller';

const router = express.Router();

router.use(isAuthenticated, requireAdmin);

router.get('/', getAllProducts);
router.get('/:id', getProductById);
router.post('/', validate(createProductSchema), createProduct);
router.put('/:id', validate(updateProductSchema), updateProduct);
router.delete('/:id', deleteProduct);

export default router; 