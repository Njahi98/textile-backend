import express from 'express';
import { isAuthenticated, requireAdmin } from '../middleware/isAuthenticated';
import { validate } from '../middleware/validation';
import { createProductSchema, updateProductSchema } from '../utils/validation';
import { uploadSingle } from '../middleware/multer';
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductImage,
  toggleProductStatus,
} from '../controllers/product.controller';

const router = express.Router();

router.use(isAuthenticated, requireAdmin);

router.get('/', getAllProducts);
router.get('/:id', getProductById);

// Create product with optional image
router.post('/', 
  uploadSingle, 
  validate(createProductSchema), 
  createProduct
);

// Update product with optional image
router.put('/:id', 
  uploadSingle, 
  validate(updateProductSchema), 
  updateProduct
);

// Toggle product active/inactive status
router.patch('/:id/toggle-status', toggleProductStatus);

// Delete product image only
router.delete('/:id/image', deleteProductImage);

// Delete entire product
router.delete('/:id', deleteProduct);

export default router;