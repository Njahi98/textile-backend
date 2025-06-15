import express from 'express';
import { isAuthenticated, requireAdmin } from '@/middleware/isAuthenticated';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/user.controller';

const router = express.Router();

// All routes require admin authentication
router.use(isAuthenticated, requireAdmin);

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;