import express from 'express';
import { isAuthenticated } from '@/middleware/isAuthenticated';
import { validate } from '@/middleware/validation';
import { updateUserSchema } from '@/utils/validation';
import {
  deleteAccount,
  updateAccount,
  updateAvatar,
  deleteAvatar,
  accountSettings,
} from '@/controllers/account.controller';
import { logout } from '@/controllers/auth.controller';
import { uploadSingle } from '@/middleware/multer';
import { imageUploadLimiter } from '@/middleware/rateLimiter';

const router = express.Router();
router.use(isAuthenticated);

router.get('/settings/account/', accountSettings);

router.put('/settings/account/', validate(updateUserSchema), updateAccount);

router.put(
  '/settings/account/avatar',
  process.env.NODE_ENV === 'production' ? imageUploadLimiter : [],
  uploadSingle,
  updateAvatar
);

router.delete('/settings/account/avatar', deleteAvatar);

router.delete('/settings/account/', deleteAccount, logout);

export default router;
