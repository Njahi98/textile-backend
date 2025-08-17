import express from 'express';
import { isAuthenticated } from '@/middleware/isAuthenticated';
import { validate } from '@/middleware/validation';
import { updateUserSchema } from '@/utils/validation';
import { deleteAccount, updateAccount } from '@/controllers/account.controller';
import { logout } from '@/controllers/auth.controller';

const router = express.Router();
router.use(isAuthenticated);

router.put('/', validate(updateUserSchema), updateAccount);
router.delete('/', deleteAccount,logout);

export default router;
