import express from 'express';
import { isAuthenticated } from '../middleware/isAuthenticated';
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

router.use(isAuthenticated);

router.get('/products/', getAllProducts);
router.get('/products/:id', getProductById);

// Create product with optional image
router.post('/products/', 
  process.env.NODE_ENV === 'production' ? imageUploadLimiter : [],
  uploadSingle, 
  validate(createProductSchema), 
  createProduct
);

// Update product with optional image
router.put('/products/:id', 
  process.env.NODE_ENV === 'production' ? imageUploadLimiter : [],
  uploadSingle, 
  validate(updateProductSchema), 
  updateProduct
);

router.patch('/products/:id/toggle-status', toggleProductStatus);

// Delete product image only
router.delete('/products/:id/image', deleteProductImage);

router.delete('/products/:id', deleteProduct);

export default router;