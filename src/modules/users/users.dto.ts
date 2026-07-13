import { z } from 'zod';
import { Role } from '@shared/constants';
import { createUserValidation, updateUserValidation } from './users.validation';

export type CreateUserDto = z.infer<typeof createUserValidation.body>;
export type UpdateUserDto = z.infer<typeof updateUserValidation.body>;

export interface UserResponseDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
