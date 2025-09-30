import express from 'express';
import { isAuthenticated, requireSuperAdmin } from '../middleware/isAuthenticated';
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
router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.post('/',requireSuperAdmin, validate(createUserSchema), createUser);
router.put('/:id',requireSuperAdmin, validate(updateUserSchema), updateUser);
router.delete('/:id',requireSuperAdmin, deleteUser);

export default router;