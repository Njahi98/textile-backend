import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(1, 'Password is required')
  .min(6, 'Password must be at least 6 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  );

export const registerSchema = z.object({
  email: z.string().email('Invalid email format').trim().toLowerCase(),
  password: passwordSchema,
  username: z.string().min(1, 'Username is required').trim(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const emailResetSchema = loginSchema.pick({
  email: true,
});

export const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
});

export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type emailResetRequest = z.infer<typeof emailResetSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetSchema>;
