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

const shiftSchema = z.enum(['morning', 'afternoon', 'night'], {
  errorMap: () => ({ message: 'Shift must be morning, afternoon, or night' })
});

export const createAssignmentSchema = z.object({
  workerId: z.number().int().positive('Worker ID must be a positive integer'),
  productionLineId: z.number().int().positive('Production line ID must be a positive integer'),
  position: z.string().min(1, 'Position is required'),
  date: z.coerce.date({
    errorMap: () => ({ message: 'Invalid date format' })
  }),
  shift: shiftSchema,
});

export const updateAssignmentSchema = z.object({
  workerId: z.number().int().positive('Worker ID must be a positive integer').optional(),
  productionLineId: z.number().int().positive('Production line ID must be a positive integer').optional(),
  position: z.string().min(1, 'Position is required').optional(),
  date: z.coerce.date({
    errorMap: () => ({ message: 'Invalid date format' })
  }).optional(),
  shift: shiftSchema.optional(),
});


// Date range query schema
export const assignmentQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  workerId: z.coerce.number().int().positive().optional(),
  productionLineId: z.coerce.number().int().positive().optional(),
  shift: shiftSchema.optional(),
  position: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Calendar view query schema
export const calendarQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2030),
  month: z.coerce.number().int().min(1).max(12),
  workerId: z.coerce.number().int().positive().optional(),
  productionLineId: z.coerce.number().int().positive().optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type AssignmentQueryInput = z.infer<typeof assignmentQuerySchema>;
export type CalendarQueryInput = z.infer<typeof calendarQuerySchema>;

export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Product code is required'),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  unitPrice: z.coerce.number().positive('Unit price must be positive').optional().nullable(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  code: z.string().min(1, 'Product code is required').optional(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  unitPrice: z.coerce.number().positive('Unit price must be positive').optional().nullable(),
  isActive: z.boolean().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;


export const createPerformanceRecordSchema = z.object({
  workerId: z.number().int().positive('Worker ID must be a positive integer'),
  productId: z.number().int().positive('Product ID must be a positive integer'),
  productionLineId: z.number().int().positive('Production line ID must be a positive integer'),
  date: z.coerce.date({
    errorMap: () => ({ message: 'Invalid date format' })
  }),
  piecesMade: z.number().int().min(0, 'Pieces made must be non-negative'),
  shift: shiftSchema.optional(),
  timeTaken: z.number().min(0, 'Time taken must be non-negative'),
  errorRate: z.number().min(0, 'Error rate must be non-negative').max(100, 'Error rate cannot exceed 100%'),
});

export const updatePerformanceRecordSchema = z.object({
  workerId: z.number().int().positive('Worker ID must be a positive integer').optional(),
  productId: z.number().int().positive('Product ID must be a positive integer').optional(),
  productionLineId: z.number().int().positive('Production line ID must be a positive integer').optional(),
  date: z.coerce.date({
    errorMap: () => ({ message: 'Invalid date format' })
  }).optional(),
  piecesMade: z.number().int().min(0, 'Pieces made must be non-negative').optional(),
  shift: shiftSchema.optional(),
  timeTaken: z.number().min(0, 'Time taken must be non-negative').optional(),
  errorRate: z.number().min(0, 'Error rate must be non-negative').max(100, 'Error rate cannot exceed 100%').optional(),
});

export const performanceRecordQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  workerId: z.coerce.number().int().positive().optional(),
  productId: z.coerce.number().int().positive().optional(),
  productionLineId: z.coerce.number().int().positive().optional(),
  shift: shiftSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreatePerformanceRecordInput = z.infer<typeof createPerformanceRecordSchema>;
export type UpdatePerformanceRecordInput = z.infer<typeof updatePerformanceRecordSchema>;
export type PerformanceRecordQueryInput = z.infer<typeof performanceRecordQuerySchema>;

//Chat and Notification Schemas
export const PaginationSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
}).transform(data => ({
  page: data.page ? parseInt(data.page, 10) || 1 : 1,
  limit: data.limit ? Math.min(parseInt(data.limit, 10) || 20, 100) : 20,
}));

export const createConversationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  participantIds: z.array(z.number().int().positive()).min(1).max(50),
  isGroup: z.boolean(),
});

export const sendMessageSchema = z.object({
  conversationId: z.number().int().positive(),
  content: z.string().min(1).max(5000),
  messageType: z.enum(['TEXT', 'IMAGE', 'FILE']).default('TEXT'),
});

export const markNotificationsReadSchema = z.object({
  notificationIds: z.array(z.number().int().positive()).optional(),
  markAll: z.boolean().optional(),
}).refine(data => data.notificationIds || data.markAll, {
  message: "Either provide notificationIds or set markAll to true",
});

export const searchUsersSchema = z.object({
  q: z.string().min(2, 'Search query must be at least 2 characters').max(100, 'Search query too long'),
});

export type CreateConversationRequest = z.infer<typeof createConversationSchema>;
export type SendMessageRequest = z.infer<typeof sendMessageSchema>;
export type MarkNotificationsReadRequest = z.infer<typeof markNotificationsReadSchema>;
export type SearchUsersRequest = z.infer<typeof searchUsersSchema>;
export type PaginationRequest = z.infer<typeof PaginationSchema>;

export const googleLoginSchema = z.object({
  credential: z.string().min(1, 'Google credential is required'),
});

export type GoogleLoginRequest = z.infer<typeof googleLoginSchema>;
