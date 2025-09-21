import express from 'express';
import { isAuthenticated, requireAdmin, requireAdminOrSuperAdmin, requireSuperAdmin } from '../middleware/isAuthenticated';
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

router.use(isAuthenticated);
router.get('/users/', getAllUsers);
router.get('/users/:id', getUserById);
router.post('/users/',requireSuperAdmin, validate(createUserSchema), createUser);
router.put('/users/:id',requireSuperAdmin, validate(updateUserSchema), updateUser);
router.delete('/users/:id',requireSuperAdmin, deleteUser);

export default router;