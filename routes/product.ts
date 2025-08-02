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
import { imageUploadLimiter } from '../middleware/rateLimiter';

const router = express.Router();

router.use(isAuthenticated, requireAdmin);

router.get('/', getAllProducts);
router.get('/:id', getProductById);

// Create product with optional image
router.post('/', 
  process.env.NODE_ENV === 'production' ? imageUploadLimiter : [],
  uploadSingle, 
  validate(createProductSchema), 
  createProduct
);

// Update product with optional image
router.put('/:id', 
  process.env.NODE_ENV === 'production' ? imageUploadLimiter : [],
  uploadSingle, 
  validate(updateProductSchema), 
  updateProduct
);

router.patch('/:id/toggle-status', toggleProductStatus);

// Delete product image only
router.delete('/:id/image', deleteProductImage);

router.delete('/:id', deleteProduct);

export default router;