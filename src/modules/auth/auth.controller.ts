import { Request, Response } from 'express';
import { catchAsync } from '@shared/utils/catch-async';
import { ApiResponse } from '@shared/utils/api-response';
import { authService } from './auth.service';

export class AuthController {
  register = catchAsync(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    ApiResponse.created(res, result, 'User registered successfully');
  });

  login = catchAsync(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    ApiResponse.success(res, result, 'Login successful');
  });

  googleLogin = catchAsync(async (req: Request, res: Response) => {
    const result = await authService.loginWithGoogle(req.body);
    ApiResponse.success(res, result, 'Google login successful');
  });

  refresh = catchAsync(async (req: Request, res: Response) => {
    const result = await authService.refresh(req.body);
    ApiResponse.success(res, result, 'Token refreshed successfully');
  });

  logout = catchAsync(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    ApiResponse.success(res, null, 'Logged out successfully');
  });

  logoutAll = catchAsync(async (req: Request, res: Response) => {
    await authService.logoutAll(req.user!.userId);
    ApiResponse.success(res, null, 'Logged out from all devices');
  });

  forgotPassword = catchAsync(async (req: Request, res: Response) => {
    const result = await authService.forgotPassword(req.body);
    // Luôn trả thành công để chống User Enumeration
    ApiResponse.success(res, result, 'If the email exists, a reset link has been sent');
  });

  resetPassword = catchAsync(async (req: Request, res: Response) => {
    await authService.resetPassword(req.body);
    ApiResponse.success(res, null, 'Password reset successfully');
  });

  changePassword = catchAsync(async (req: Request, res: Response) => {
    await authService.changePassword(req.user!.userId, req.body);
    ApiResponse.success(res, null, 'Password changed successfully');
  });

  getMe = catchAsync(async (req: Request, res: Response) => {
    const user = await authService.getMe(req.user!.userId);
    ApiResponse.success(res, user, 'User profile retrieved');
  });
}

export const authController = new AuthController();
