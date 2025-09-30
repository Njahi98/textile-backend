import express from 'express';
import { isAuthenticated } from '../middleware/isAuthenticated';
import { validate } from '../middleware/validation';
import { updateUserSchema } from '../utils/validation';
import {
  deleteAccount,
  updateAccount,
  updateAvatar,
  deleteAvatar,
  accountSettings,
} from '../controllers/account.controller';
import { logout } from '../controllers/auth.controller';
import { uploadSingle } from '../middleware/multer';
import { imageUploadLimiter } from '../middleware/rateLimiter';

const router = express.Router();
router.use(isAuthenticated);

router.get('/account/', accountSettings);

router.put('/account/', validate(updateUserSchema), updateAccount);

router.put(
  '/account/avatar',
  process.env.NODE_ENV === 'production' ? imageUploadLimiter : [],
  uploadSingle,
  updateAvatar
);

router.delete('/account/avatar', deleteAvatar);

router.delete('/account/', deleteAccount, logout);

export default router;
