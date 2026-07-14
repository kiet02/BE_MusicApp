import { AuthService } from '../auth.service';
import { User } from '@modules/users/users.model';
import { RefreshToken } from '../refresh-token.model';
import { PasswordReset, hashToken } from '../password-reset.model';
import { StatusCodes } from 'http-status-codes';

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    startSession: jest.fn().mockResolvedValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    }),
  };
});

jest.mock('@modules/users/users.model');
jest.mock('../refresh-token.model', () => {
  const actual = jest.requireActual('../refresh-token.model');
  return {
    ...actual,
    RefreshToken: {
      create: jest.fn().mockResolvedValue({}),
      findOne: jest.fn(),
      deleteOne: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({}),
    },
  };
});
jest.mock('../password-reset.model', () => {
  const actual = jest.requireActual('../password-reset.model');
  return {
    ...actual,
    PasswordReset: {
      create: jest.fn().mockResolvedValue({}),
      findOne: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({}),
    },
  };
});
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn(),
  })),
}));
jest.mock('@shared/config/env', () => ({
  config: {
    jwt: {
      secret: 'test-secret-key',
      expiresIn: '15m',
      refreshSecret: 'test-refresh-secret',
      refreshExpiresIn: '7d',
    },
    google: { clientId: 'test-id' },
  },
}));

const UserMock = User as jest.Mocked<typeof User>;
const RefreshTokenMock = RefreshToken as jest.Mocked<typeof RefreshToken>;
const PasswordResetMock = PasswordReset as jest.Mocked<typeof PasswordReset>;

const mockUser = (overrides = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  name: 'Test User',
  email: 'test@example.com',
  password: 'hashed-password',
  role: 'user',
  isActive: true,
  comparePassword: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('Password Management & Logout All', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  // ════════════════════════════════════════════════════════
  // Forgot Password
  // ════════════════════════════════════════════════════════

  describe('forgotPassword', () => {
    it('should generate reset token and store hashed version in DB', async () => {
      const user = mockUser();
      (UserMock.findOne as jest.Mock).mockResolvedValue(user);

      const result = await authService.forgotPassword({ email: 'test@example.com' });

      expect(UserMock.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(PasswordResetMock.deleteMany).toHaveBeenCalledWith(
        { userId: user._id },
        expect.objectContaining({ session: expect.anything() }),
      );
      expect(PasswordResetMock.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            token: expect.any(String),
            userId: user._id,
            expiresAt: expect.any(Date),
          }),
        ],
        expect.objectContaining({ session: expect.anything() }),
      );
      expect(result).toHaveProperty('resetToken');
      expect(result!.resetToken.length).toBe(64); // 32 bytes hex
    });

    it('should store SHA-256 hashed token, not plain token', async () => {
      const user = mockUser();
      (UserMock.findOne as jest.Mock).mockResolvedValue(user);

      const result = await authService.forgotPassword({ email: 'test@example.com' });
      expect(PasswordResetMock.create).toHaveBeenCalled();
      const createArgs = (PasswordResetMock.create as jest.Mock).mock.calls[0];
      const storedToken = createArgs[0][0].token;
      const expectedHash = hashToken(result!.resetToken);

      expect(storedToken).toBe(expectedHash);
      expect(storedToken).not.toBe(result!.resetToken);
    });

    it('should return null if email does not exist (anti User Enumeration)', async () => {
      (UserMock.findOne as jest.Mock).mockResolvedValue(null);

      const result = await authService.forgotPassword({ email: 'nonexistent@example.com' });

      expect(result).toBeNull();
      expect(PasswordResetMock.create).not.toHaveBeenCalled();
    });

    it('should delete old reset tokens before creating new one', async () => {
      const user = mockUser();
      (UserMock.findOne as jest.Mock).mockResolvedValue(user);

      await authService.forgotPassword({ email: 'test@example.com' });

      const deleteManyOrder = (PasswordResetMock.deleteMany as jest.Mock).mock
        .invocationCallOrder[0];
      const createOrder = (PasswordResetMock.create as jest.Mock).mock.invocationCallOrder[0];
      expect(deleteManyOrder).toBeLessThan(createOrder);
    });
  });

  // ════════════════════════════════════════════════════════
  // Reset Password
  // ════════════════════════════════════════════════════════

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const user = mockUser();
      const resetRecord = {
        token: hashToken('valid-plain-token'),
        userId: user._id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min future
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };

      (PasswordResetMock.findOne as jest.Mock).mockResolvedValue(resetRecord);
      (UserMock.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authService.resetPassword({
        token: 'valid-plain-token',
        password: 'NewPass123',
      });

      expect(user.save).toHaveBeenCalled();
      expect(PasswordResetMock.deleteMany).toHaveBeenCalledWith(
        { userId: user._id },
        expect.objectContaining({ session: expect.anything() }),
      );
      expect(RefreshTokenMock.deleteMany).toHaveBeenCalledWith(
        { userId: user._id },
        expect.objectContaining({ session: expect.anything() }),
      );
    });

    it('should throw BadRequestError if token not found', async () => {
      (PasswordResetMock.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.resetPassword({ token: 'invalid-token', password: 'NewPass123' }),
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: StatusCodes.BAD_REQUEST,
          message: expect.stringContaining('AUTH_010'),
        }),
      );
    });

    it('should throw BadRequestError if token is expired', async () => {
      const resetRecord = {
        token: hashToken('expired-token'),
        userId: '507f1f77bcf86cd799439011',
        expiresAt: new Date(Date.now() - 1000), // Expired
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };

      (PasswordResetMock.findOne as jest.Mock).mockResolvedValue(resetRecord);

      await expect(
        authService.resetPassword({ token: 'expired-token', password: 'NewPass123' }),
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: StatusCodes.BAD_REQUEST,
          message: expect.stringContaining('AUTH_010'),
        }),
      );

      expect(resetRecord.deleteOne).toHaveBeenCalled();
    });

    it('should invalidate all sessions after password reset', async () => {
      const user = mockUser();
      const resetRecord = {
        token: hashToken('valid-token'),
        userId: user._id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };

      (PasswordResetMock.findOne as jest.Mock).mockResolvedValue(resetRecord);
      (UserMock.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authService.resetPassword({ token: 'valid-token', password: 'NewPass123' });

      expect(RefreshTokenMock.deleteMany).toHaveBeenCalledWith(
        { userId: user._id },
        expect.objectContaining({ session: expect.anything() }),
      );
    });
  });

  // ════════════════════════════════════════════════════════
  // Change Password
  // ════════════════════════════════════════════════════════

  describe('changePassword', () => {
    it('should change password when current password is correct', async () => {
      const user = mockUser();
      user.comparePassword
        .mockResolvedValueOnce(true) // currentPassword check
        .mockResolvedValueOnce(false); // newPassword != currentPassword

      (UserMock.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authService.changePassword('507f1f77bcf86cd799439011', {
        currentPassword: 'OldPass123',
        newPassword: 'NewPass456',
      });

      expect(user.password).toBe('NewPass456');
      expect(user.save).toHaveBeenCalled();
      expect(RefreshTokenMock.deleteMany).toHaveBeenCalledWith(
        { userId: user._id },
        expect.objectContaining({ session: expect.anything() }),
      );
    });

    it('should throw UnauthorizedError if current password is wrong', async () => {
      const user = mockUser();
      user.comparePassword.mockResolvedValue(false);

      (UserMock.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await expect(
        authService.changePassword('507f1f77bcf86cd799439011', {
          currentPassword: 'WrongPass',
          newPassword: 'NewPass456',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: StatusCodes.UNAUTHORIZED,
          message: expect.stringContaining('AUTH_011'),
        }),
      );
    });

    it('should throw BadRequestError if new password is same as current', async () => {
      const user = mockUser();
      user.comparePassword
        .mockResolvedValueOnce(true) // currentPassword matches
        .mockResolvedValueOnce(true); // newPassword also matches (same!)

      (UserMock.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await expect(
        authService.changePassword('507f1f77bcf86cd799439011', {
          currentPassword: 'SamePass123',
          newPassword: 'SamePass123',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: StatusCodes.BAD_REQUEST,
          message: expect.stringContaining('AUTH_012'),
        }),
      );
    });

    it('should throw NotFoundError if user does not exist', async () => {
      (UserMock.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        authService.changePassword('nonexistent-id', {
          currentPassword: 'OldPass123',
          newPassword: 'NewPass456',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: StatusCodes.NOT_FOUND,
        }),
      );
    });

    it('should invalidate all sessions after password change', async () => {
      const user = mockUser();
      user.comparePassword.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      (UserMock.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authService.changePassword('507f1f77bcf86cd799439011', {
        currentPassword: 'OldPass123',
        newPassword: 'NewPass456',
      });

      expect(RefreshTokenMock.deleteMany).toHaveBeenCalledWith(
        { userId: user._id },
        expect.objectContaining({ session: expect.anything() }),
      );
    });
  });

  // ════════════════════════════════════════════════════════
  // Logout All Devices
  // ════════════════════════════════════════════════════════

  describe('logoutAll', () => {
    it('should delete all refresh tokens for the user', async () => {
      await authService.logoutAll('507f1f77bcf86cd799439011');

      expect(RefreshTokenMock.deleteMany).toHaveBeenCalledWith({
        userId: '507f1f77bcf86cd799439011',
      });
    });

    it('should not throw even if user has no active sessions', async () => {
      (RefreshTokenMock.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 0 });

      await expect(authService.logoutAll('507f1f77bcf86cd799439011')).resolves.not.toThrow();
    });
  });
});
