import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { User, IUser } from '@modules/users/users.model';
import {
  RegisterDto, LoginDto, RefreshTokenDto, GoogleLoginDto,
  ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto,
  AuthResponseDto,
} from './auth.dto';
import { config } from '@shared/config/env';
import { UnauthorizedError, ConflictError, NotFoundError, BadRequestError } from '@shared/utils/api-error';
import { AUTH_ERRORS } from './auth.code';
import { RefreshToken, generateRefreshTokenString, parseDuration } from './refresh-token.model';
import { PasswordReset, generateResetToken, hashToken } from './password-reset.model';

export class AuthService {
  async register(data: RegisterDto): Promise<AuthResponseDto> {
    const email = data.email.trim().toLowerCase();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ConflictError(AUTH_ERRORS.EMAIL_ALREADY_REGISTERED);
    }

    const user = await User.create({
      name: data.name,
      email,
      password: data.password,
    });

    return this.createAuthResponse(user);
  }

  async login(data: LoginDto): Promise<AuthResponseDto> {
    const email = data.email.trim().toLowerCase();

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      throw new UnauthorizedError(AUTH_ERRORS.INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      throw new UnauthorizedError(AUTH_ERRORS.ACCOUNT_DEACTIVATED);
    }

    const isPasswordMatch = await user.comparePassword(data.password);
    if (!isPasswordMatch) {
      throw new UnauthorizedError(AUTH_ERRORS.INVALID_CREDENTIALS);
    }

    return this.createAuthResponse(user);
  }

  async refresh(data: RefreshTokenDto): Promise<AuthResponseDto> {
    const storedToken = await RefreshToken.findOne({ token: data.refreshToken });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      if (storedToken) await storedToken.deleteOne();
      throw new UnauthorizedError(AUTH_ERRORS.INVALID_REFRESH_TOKEN);
    }

    const user = await User.findById(storedToken.userId);
    if (!user || !user.isActive) {
      await storedToken.deleteOne();
      throw new UnauthorizedError(AUTH_ERRORS.INVALID_REFRESH_TOKEN);
    }

    await storedToken.deleteOne();

    return this.createAuthResponse(user);
  }

  async logout(refreshToken: string): Promise<void> {
    await RefreshToken.deleteOne({ token: refreshToken });
  }

  async loginWithGoogle(data: GoogleLoginDto): Promise<AuthResponseDto> {
    let email: string;
    let name: string;

    const token = data.idToken.trim();

    if (token.startsWith('ya29.')) {
      try {
        const response = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`);
        if (!response.ok) {
          throw new Error('Google userinfo fetch failed');
        }
        const payload: any = await response.json();
        if (!payload || !payload.email) {
          throw new UnauthorizedError(AUTH_ERRORS.INVALID_GOOGLE_TOKEN);
        }
        if (!payload.email_verified) {
          throw new UnauthorizedError(AUTH_ERRORS.GOOGLE_EMAIL_NOT_VERIFIED);
        }
        email = payload.email.toLowerCase().trim();
        name = payload.name || 'Google User';
      } catch (error: any) {
        if (error?.statusCode) throw error;
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
      } catch (error: any) {
        if (error?.statusCode) throw error;
        throw new UnauthorizedError(AUTH_ERRORS.INVALID_GOOGLE_TOKEN);
      }
    }

    let user = await User.findOne({ email });
    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString('hex') + 'A1!';
      user = await User.create({
        name,
        email,
        password: randomPassword,
        role: 'user',
      });
    } else if (!user.isActive) {
      throw new UnauthorizedError(AUTH_ERRORS.ACCOUNT_DEACTIVATED);
    }

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
    if (!user) return null;

    // Xóa tất cả reset token cũ của user
    await PasswordReset.deleteMany({ userId: user._id });

    // Tạo token mới
    const { plainToken, hashedToken } = generateResetToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    await PasswordReset.create({
      token: hashedToken,
      userId: user._id,
      expiresAt,
    });

    // TODO: Gửi email chứa plainToken cho user
    // Tạm thời trả về token để test
    return { resetToken: plainToken };
  }

  async resetPassword(data: ResetPasswordDto): Promise<void> {
    const hashedToken = hashToken(data.token);

    const resetRecord = await PasswordReset.findOne({ token: hashedToken });
    if (!resetRecord || resetRecord.expiresAt < new Date()) {
      if (resetRecord) await resetRecord.deleteOne();
      throw new BadRequestError(AUTH_ERRORS.RESET_TOKEN_INVALID);
    }

    const user = await User.findById(resetRecord.userId).select('+password');
    if (!user) {
      await resetRecord.deleteOne();
      throw new BadRequestError(AUTH_ERRORS.RESET_TOKEN_INVALID);
    }

    // Cập nhật mật khẩu (pre-save hook sẽ hash bằng bcrypt)
    user.password = data.password;
    await user.save();

    // Xóa tất cả reset tokens + refresh tokens (đá ra mọi thiết bị)
    await PasswordReset.deleteMany({ userId: user._id });
    await RefreshToken.deleteMany({ userId: user._id });
  }

  async changePassword(userId: string, data: ChangePasswordDto): Promise<void> {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new NotFoundError('User');
    }

    const isMatch = await user.comparePassword(data.currentPassword);
    if (!isMatch) {
      throw new UnauthorizedError(AUTH_ERRORS.WRONG_CURRENT_PASSWORD);
    }

    // Kiểm tra mật khẩu mới khác mật khẩu cũ
    const isSame = await user.comparePassword(data.newPassword);
    if (isSame) {
      throw new BadRequestError(AUTH_ERRORS.SAME_PASSWORD);
    }

    user.password = data.newPassword;
    await user.save();

    // Xóa tất cả refresh tokens (buộc đăng nhập lại trên mọi thiết bị)
    await RefreshToken.deleteMany({ userId: user._id });
  }

  async logoutAll(userId: string): Promise<void> {
    await RefreshToken.deleteMany({ userId });
  }

  // ─── Private Helpers ─────────────────────────────────────────

  private async createAuthResponse(user: IUser): Promise<AuthResponseDto> {
    const userId = String(user._id);
    const accessToken = this.generateAccessToken(userId, user.role);
    const refreshToken = await this.createRefreshToken(userId);

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
    return jwt.sign(
      { userId, role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as jwt.SignOptions,
    );
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const token = generateRefreshTokenString();
    const expiresAt = new Date(Date.now() + parseDuration(config.jwt.refreshExpiresIn));

    await RefreshToken.create({ token, userId, expiresAt });

    return token;
  }
}

export const authService = new AuthService();
