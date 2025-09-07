import express from 'express';
import { getCurrentUser, login, logout, register, requestPasswordReset, resetPassword,refreshToken } from '../controllers/auth.controller';
import { validate } from '../middleware/validation';
import { registerSchema, loginSchema, emailResetSchema, passwordResetSchema } from '../utils/validation';
import { isAuthenticated } from '@/middleware/isAuthenticated';

const router = express.Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/logout', logout);
router.post('/password-reset-request', validate(emailResetSchema), requestPasswordReset);
router.post('/password-reset', validate(passwordResetSchema), resetPassword);
router.post('/refresh', refreshToken);


// Get current user on protected route
router.get('/me', isAuthenticated, getCurrentUser);


export default router;