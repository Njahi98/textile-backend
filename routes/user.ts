import express from 'express';
import { isAuthenticated, requireAdmin } from '@/middleware/isAuthenticated';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/user.controller';
import { validate } from '../middleware/validation';
import { createUserSchema, updateUserSchema } from '../utils/validation';

const router = express.Router();

// All routes require admin authentication
router.use(isAuthenticated, requireAdmin);

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.post('/', validate(createUserSchema), createUser);
router.put('/:id', validate(updateUserSchema), updateUser);
router.delete('/:id', deleteUser);

export default router;