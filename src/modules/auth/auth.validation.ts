import { z } from 'zod';
import { AUTH_ERRORS } from './auth.code';

export const registerValidation = {
  body: z.object({
    name: z
      .string({ message: AUTH_ERRORS.VAL_NAME_REQUIRED })
      .trim()
      .min(2, AUTH_ERRORS.VAL_NAME_MIN)
      .max(50, AUTH_ERRORS.VAL_NAME_MAX),
    email: z
      .string({ message: AUTH_ERRORS.VAL_EMAIL_REQUIRED })
      .trim()
      .toLowerCase()
      .pipe(z.email({ message: AUTH_ERRORS.VAL_EMAIL_INVALID })),
    password: z
      .string({ message: AUTH_ERRORS.VAL_PASSWORD_REQUIRED })
      .min(6, AUTH_ERRORS.VAL_PASSWORD_MIN)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, AUTH_ERRORS.VAL_PASSWORD_WEAK),
  }),
};

export const loginValidation = {
  body: z.object({
    email: z
      .string({ message: AUTH_ERRORS.VAL_EMAIL_REQUIRED })
      .trim()
      .toLowerCase()
      .min(1, AUTH_ERRORS.VAL_EMAIL_EMPTY)
      .pipe(z.email({ message: AUTH_ERRORS.VAL_EMAIL_INVALID })),
    password: z
      .string({ message: AUTH_ERRORS.VAL_PASSWORD_REQUIRED })
      .min(1, AUTH_ERRORS.VAL_PASSWORD_REQUIRED),
  }),
};

export const refreshTokenValidation = {
  body: z.object({
    refreshToken: z
      .string({ message: AUTH_ERRORS.REFRESH_TOKEN_REQUIRED })
      .min(1, AUTH_ERRORS.REFRESH_TOKEN_REQUIRED),
  }),
};

export const googleLoginValidation = {
  body: z.object({
    idToken: z
      .string({ message: AUTH_ERRORS.VAL_ID_TOKEN_REQUIRED })
      .min(1, AUTH_ERRORS.VAL_ID_TOKEN_REQUIRED),
  }),
};

export const forgotPasswordValidation = {
  body: z.object({
    email: z
      .string({ message: AUTH_ERRORS.VAL_EMAIL_REQUIRED })
      .trim()
      .toLowerCase()
      .min(1, AUTH_ERRORS.VAL_EMAIL_EMPTY)
      .pipe(z.email({ message: AUTH_ERRORS.VAL_EMAIL_INVALID })),
  }),
};

export const resetPasswordValidation = {
  body: z.object({
    token: z
      .string({ message: AUTH_ERRORS.VAL_RESET_TOKEN_REQUIRED })
      .min(1, AUTH_ERRORS.VAL_RESET_TOKEN_REQUIRED),
    password: z
      .string({ message: AUTH_ERRORS.VAL_NEW_PASSWORD_REQUIRED })
      .min(6, AUTH_ERRORS.VAL_NEW_PASSWORD_MIN)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, AUTH_ERRORS.VAL_NEW_PASSWORD_WEAK),
  }),
};

export const changePasswordValidation = {
  body: z.object({
    currentPassword: z
      .string({ message: AUTH_ERRORS.VAL_CURRENT_PASSWORD_REQUIRED })
      .min(1, AUTH_ERRORS.VAL_CURRENT_PASSWORD_REQUIRED),
    newPassword: z
      .string({ message: AUTH_ERRORS.VAL_NEW_PASSWORD_REQUIRED })
      .min(6, AUTH_ERRORS.VAL_NEW_PASSWORD_MIN)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, AUTH_ERRORS.VAL_NEW_PASSWORD_WEAK),
  }),
};
