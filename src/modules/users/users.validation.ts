import { z } from 'zod';
import { ROLES } from '@shared/constants';

// Zod requires at least one element for enum array, we cast it safely
const roleValues = [ROLES.ADMIN, ROLES.USER] as const;

export const createUserValidation = {
  body: z.object({
    name: z
      .string({ message: 'Name is required' })
      .min(2, 'Name must be at least 2 characters')
      .max(50, 'Name must be at most 50 characters'),
    email: z
      .string({ message: 'Email is required' })
      .pipe(z.email({ message: 'Please provide a valid email' })),
    password: z
      .string({ message: 'Password is required' })
      .min(6, 'Password must be at least 6 characters'),
    role: z.enum(roleValues).default(ROLES.USER),
  }),
};

export const updateUserValidation = {
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format'),
  }),
  body: z
    .object({
      name: z.string().min(2).max(50).optional(),
      email: z.string().pipe(z.email()).optional(),
      role: z.enum(roleValues).optional(),
      isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update',
      path: [],
    }),
};

export const getUserByIdValidation = {
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format'),
  }),
};

export const getUsersValidation = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    sort: z.enum(['createdAt', 'name', 'email']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().optional(),
  }),
};
