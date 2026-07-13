import { z } from 'zod';
import {
  registerValidation,
  loginValidation,
  refreshTokenValidation,
  googleLoginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
} from './auth.validation';

export type RegisterDto = z.infer<typeof registerValidation.body>;
export type LoginDto = z.infer<typeof loginValidation.body>;
export type RefreshTokenDto = z.infer<typeof refreshTokenValidation.body>;
export type GoogleLoginDto = z.infer<typeof googleLoginValidation.body>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordValidation.body>;
export type ResetPasswordDto = z.infer<typeof resetPasswordValidation.body>;
export type ChangePasswordDto = z.infer<typeof changePasswordValidation.body>;

export interface AuthResponseDto {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
}
