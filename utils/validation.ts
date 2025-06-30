import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(1, 'Password is required')
  .min(6, 'Password must be at least 6 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  );

  const cinSchema = z.string().regex(/^\d{8}$/, {
    message: "CIN must be exactly 8 digits",
  });
  

const roleSchema = z.enum(['USER', 'ADMIN', 'SUPERADMIN']).optional();
const statusSchema = z.enum(['active', 'inactive', 'suspended']).optional();

export const registerSchema = z.object({
  email: z.string().email('Invalid email format').trim().toLowerCase(),
  password: passwordSchema,
  username: z.string().min(1, 'Username is required').trim(),
});

// User creation (admin)
export const createUserSchema = z.object({
  email: z.string().email('Invalid email format').trim().toLowerCase(),
  password: passwordSchema,
  username: z.string().min(1, 'Username is required').trim(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  role: roleSchema,
  status: statusSchema,
});

// User update (admin, all fields optional)
export const updateUserSchema = z.object({
  email: z.string().email('Invalid email format').trim().toLowerCase().optional(),
  password: passwordSchema.optional(),
  username: z.string().min(1, 'Username is required').trim().optional(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  role: roleSchema,
  status: statusSchema,
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


export const workerCreateSchema = z.object({
  name:z.string().min(1,'Name is required'),
  cin: cinSchema,
  email: z.string().email('Invalid email format').trim().toLowerCase().optional().nullable(),
  phone: z.string().optional().nullable(),
  role:z.string().min(1,'Role is required').optional(),
})
export const workerUpdateSchema = z.object({
  name:z.string().min(1,'Name is required').optional(),
  cin: cinSchema.optional(),
  role:z.string().min(1,'Role is required').optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Invalid email format').trim().toLowerCase().optional(),
})

export const createProductionLineSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  capacity: z.number().int().positive('Capacity must be a positive integer').optional().nullable(),
  targetOutput: z.number().int().positive('Target output must be a positive integer').optional().nullable(),
  location: z.string().optional().nullable(),
});

export const updateProductionLineSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional().nullable(),
  capacity: z.number().int().positive('Capacity must be a positive integer').optional().nullable(),
  targetOutput: z.number().int().positive('Target output must be a positive integer').optional().nullable(),
  location: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type CreateProductionLineInput = z.infer<typeof createProductionLineSchema>;
export type UpdateProductionLineInput = z.infer<typeof updateProductionLineSchema>;