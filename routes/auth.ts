import express from 'express';
import { login, logout, register, requestPasswordReset, resetPassword } from '../controllers/auth.controller';
import { validate } from '../middleware/validation';
import { registerSchema, loginSchema, emailResetSchema, passwordResetSchema } from '../utils/validation';

const router = express.Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/logout', logout);
router.post('/password-reset',validate(emailResetSchema),requestPasswordReset)
router.post('/password-reset/:token',validate(passwordResetSchema),resetPassword)

export default router;