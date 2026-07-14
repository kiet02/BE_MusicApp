import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { OAuth2Client } from 'google-auth-library';
import { User, IUser } from '@modules/users/users.model';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  GoogleLoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  AuthResponseDto,
} from './auth.dto';
import { config } from '@shared/config/env';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  BadRequestError,
} from '@shared/utils/api-error';
import { AUTH_ERRORS } from './auth.code';
import { RefreshToken, generateRefreshTokenString, parseDuration } from './refresh-token.model';
import { PasswordReset, generateResetToken, hashToken } from './password-reset.model';
import { logger } from '@shared/utils/logger';

export class AuthService {
  async register(data: RegisterDto): Promise<AuthResponseDto> {
    const email = data.email.trim().toLowerCase();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn(`Register attempt with existing email: ${email}`);
      throw new ConflictError(AUTH_ERRORS.EMAIL_ALREADY_REGISTERED);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const [user] = await User.create(
        [
          {
            name: data.name,
            email,
            password: data.password,
          },
        ],
        { session },
      );

      const response = await this.createAuthResponse(user, session);
      await session.commitTransaction();

      logger.info(`User registered successfully: ${email}`);
      return response;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Registration failed for ${email}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async login(data: LoginDto): Promise<AuthResponseDto> {
    const email = data.email.trim().toLowerCase();

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      logger.warn(`Failed login attempt (user not found): ${email}`);
      throw new UnauthorizedError(AUTH_ERRORS.INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      logger.warn(`Failed login attempt (deactivated account): ${email}`);
      throw new UnauthorizedError(AUTH_ERRORS.ACCOUNT_DEACTIVATED);
    }

    const isPasswordMatch = await user.comparePassword(data.password);
    if (!isPasswordMatch) {
      logger.warn(`Failed login attempt (wrong password): ${email}`);
      throw new UnauthorizedError(AUTH_ERRORS.INVALID_CREDENTIALS);
    }

    logger.info(`User logged in successfully: ${email}`);
    return this.createAuthResponse(user);
  }

  async refresh(data: RefreshTokenDto): Promise<AuthResponseDto> {
    const storedToken = await RefreshToken.findOne({ token: data.refreshToken });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      if (storedToken) await storedToken.deleteOne();
      logger.warn('Failed token refresh (invalid or expired refresh token)');
      throw new UnauthorizedError(AUTH_ERRORS.INVALID_REFRESH_TOKEN);
    }

    const user = await User.findById(storedToken.userId);
    if (!user || !user.isActive) {
      await storedToken.deleteOne();
      logger.warn(`Failed token refresh (user not found or deactivated): ${storedToken.userId}`);
      throw new UnauthorizedError(AUTH_ERRORS.INVALID_REFRESH_TOKEN);
    }

    await storedToken.deleteOne();

    logger.info(`Token refreshed successfully for user: ${user.email}`);
    return this.createAuthResponse(user);
  }

  async logout(refreshToken: string): Promise<void> {
    await RefreshToken.deleteOne({ token: refreshToken });
    logger.info('User logged out');
  }

  async loginWithGoogle(data: GoogleLoginDto): Promise<AuthResponseDto> {
    let email: string;
    let name: string;

    const token = data.idToken.trim();

    if (token.startsWith('ya29.')) {
      try {
        const response = await fetch(
          `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`,
        );
        if (!response.ok) {
          throw new Error('Google userinfo fetch failed');
        }
        const payload = (await response.json()) as {
          email?: string;
          email_verified?: boolean;
          name?: string;
        };
        if (!payload || !payload.email) {
          throw new UnauthorizedError(AUTH_ERRORS.INVALID_GOOGLE_TOKEN);
        }
        if (!payload.email_verified) {
          throw new UnauthorizedError(AUTH_ERRORS.GOOGLE_EMAIL_NOT_VERIFIED);
        }
        email = payload.email.toLowerCase().trim();
        name = payload.name || 'Google User';
      } catch (error: unknown) {
        if ((error as { statusCode?: number })?.statusCode) throw error;
        logger.warn('Failed Google login (Invalid Google ID Token)');
        throw new UnauthorizedError(AUTH_ERRORS.INVALID_GOOGLE_TOKEN);
      }
    } else {
      if (!config.google.clientId) {
        throw new BadRequestError(AUTH_ERRORS.GOOGLE_CONFIG_ERROR);
      }

      const client = new OAuth2Client(config.google.clientId);
      try {
        const ticket = await client.verifyIdToken({
          idToken: token,
          audience: config.google.clientId,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          throw new UnauthorizedError(AUTH_ERRORS.INVALID_GOOGLE_TOKEN);
        }
        if (!payload.email_verified) {
          throw new UnauthorizedError(AUTH_ERRORS.GOOGLE_EMAIL_NOT_VERIFIED);
        }
        email = payload.email.toLowerCase().trim();
        name = payload.name || 'Google User';
      } catch (error: unknown) {
        if ((error as { statusCode?: number })?.statusCode) throw error;
        logger.warn('Failed Google login (Invalid Google ID Token verification)');
        throw new UnauthorizedError(AUTH_ERRORS.INVALID_GOOGLE_TOKEN);
      }
    }

    let user = await User.findOne({ email });
    if (!user) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const randomPassword = crypto.randomBytes(32).toString('hex') + 'A1!';
        const [newUser] = await User.create(
          [
            {
              name,
              email,
              password: randomPassword,
              role: 'user',
            },
          ],
          { session },
        );
        user = newUser;

        const response = await this.createAuthResponse(user, session);
        await session.commitTransaction();

        logger.info(`New user registered via Google: ${email}`);
        return response;
      } catch (error) {
        await session.abortTransaction();
        logger.error(`Google registration failed for ${email}:`, error);
        throw error;
      } finally {
        session.endSession();
      }
    } else if (!user.isActive) {
      logger.warn(`Failed Google login attempt (deactivated account): ${email}`);
      throw new UnauthorizedError(AUTH_ERRORS.ACCOUNT_DEACTIVATED);
    }

    logger.info(`User logged in via Google: ${email}`);
    return this.createAuthResponse(user);
  }

  async getMe(userId: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }
    return user;
  }

  async forgotPassword(data: ForgotPasswordDto): Promise<{ resetToken: string } | null> {
    const email = data.email.trim().toLowerCase();
    const user = await User.findOne({ email });

    // Luôn trả về thành công để chống User Enumeration
    if (!user) {
      logger.warn(`Forgot password requested for non-existent email: ${email}`);
      return null;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Xóa tất cả reset token cũ của user
      await PasswordReset.deleteMany({ userId: user._id }, { session });

      // Tạo token mới
      const { plainToken, hashedToken } = generateResetToken();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

      await PasswordReset.create(
        [
          {
            token: hashedToken,
            userId: user._id,
            expiresAt,
          },
        ],
        { session },
      );

      await session.commitTransaction();
      logger.info(`Password reset requested for user: ${user.email}`);

      // TODO: Gửi email chứa plainToken cho user
      // Tạm thời trả về token để test
      return { resetToken: plainToken };
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Forgot password flow failed for ${email}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async resetPassword(data: ResetPasswordDto): Promise<void> {
    const hashedToken = hashToken(data.token);

    const resetRecord = await PasswordReset.findOne({ token: hashedToken });
    if (!resetRecord || resetRecord.expiresAt < new Date()) {
      if (resetRecord) await resetRecord.deleteOne();
      logger.warn('Failed password reset attempt (invalid or expired token)');
      throw new BadRequestError(AUTH_ERRORS.RESET_TOKEN_INVALID);
    }

    const user = await User.findById(resetRecord.userId).select('+password');
    if (!user) {
      await resetRecord.deleteOne();
      logger.warn('Failed password reset attempt (user not found from token)');
      throw new BadRequestError(AUTH_ERRORS.RESET_TOKEN_INVALID);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Cập nhật mật khẩu (pre-save hook sẽ hash bằng bcrypt)
      user.password = data.password;
      await user.save({ session });

      // Xóa tất cả reset tokens + refresh tokens (đá ra mọi thiết bị)
      await PasswordReset.deleteMany({ userId: user._id }, { session });
      await RefreshToken.deleteMany({ userId: user._id }, { session });

      await session.commitTransaction();
      logger.info(`Password reset successfully for user: ${user.email}`);
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Password reset failed for user ${user.email}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async changePassword(userId: string, data: ChangePasswordDto): Promise<void> {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new NotFoundError('User');
    }

    const isMatch = await user.comparePassword(data.currentPassword);
    if (!isMatch) {
      logger.warn(`Failed change password attempt (wrong current password): ${user.email}`);
      throw new UnauthorizedError(AUTH_ERRORS.WRONG_CURRENT_PASSWORD);
    }

    // Kiểm tra mật khẩu mới khác mật khẩu cũ
    const isSame = await user.comparePassword(data.newPassword);
    if (isSame) {
      throw new BadRequestError(AUTH_ERRORS.SAME_PASSWORD);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      user.password = data.newPassword;
      await user.save({ session });

      // Xóa tất cả refresh tokens (buộc đăng nhập lại trên mọi thiết bị)
      await RefreshToken.deleteMany({ userId: user._id }, { session });

      await session.commitTransaction();
      logger.info(`Password changed successfully for user: ${user.email}`);
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Password change failed for user ${user.email}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await RefreshToken.deleteMany({ userId });
    logger.info(`User logged out from all devices: ${userId}`);
  }

  // ─── Private Helpers ─────────────────────────────────────────

  private async createAuthResponse(user: IUser, session?: ClientSession): Promise<AuthResponseDto> {
    const userId = String(user._id);
    const accessToken = this.generateAccessToken(userId, user.role);
    const refreshToken = await this.createRefreshToken(userId, session);

    return {
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  private generateAccessToken(userId: string, role: string): string {
    return jwt.sign({ userId, role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);
  }

  private async createRefreshToken(userId: string, session?: ClientSession): Promise<string> {
    const token = generateRefreshTokenString();
    const expiresAt = new Date(Date.now() + parseDuration(config.jwt.refreshExpiresIn));

    if (session) {
      await RefreshToken.create([{ token, userId, expiresAt }], { session });
    } else {
      await RefreshToken.create({ token, userId, expiresAt });
    }

    return token;
  }
}

export const authService = new AuthService();
