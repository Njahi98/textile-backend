import express from 'express';
import { login, logout, register } from '../controllers/auth.controller';
import { validate } from '../middleware/validation';
import { registerSchema, loginSchema } from '../utils/validation';

const router = express.Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/logout', logout);

export default router;