import express from 'express';
import { isAuthenticated } from '@/middleware/isAuthenticated';
import { validate } from '@/middleware/validation';
import { updateUserSchema } from '@/utils/validation';
import { deleteAccount, updateAccount, updateAvatar, deleteAvatar, accountSettings } from '@/controllers/account.controller';
import { logout } from '@/controllers/auth.controller';
import { uploadSingle } from '@/middleware/multer';
import { imageUploadLimiter } from '@/middleware/rateLimiter';

const router = express.Router();
router.use(isAuthenticated);

router.get('/', accountSettings);

router.put('/', validate(updateUserSchema), updateAccount);

router.put('/avatar', 
  process.env.NODE_ENV === 'production' ? imageUploadLimiter : [],
  uploadSingle,
  updateAvatar
);

router.delete('/avatar', deleteAvatar);

router.delete('/', deleteAccount, logout);

export default router;