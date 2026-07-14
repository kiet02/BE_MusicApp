import jwt from 'jsonwebtoken';
import { AuthService } from '../auth.service';
import { RefreshToken } from '../refresh-token.model';
import { ApiError } from '@shared/utils/api-error';
import { AUTH_ERRORS } from '../auth.code';
import { StatusCodes } from 'http-status-codes';
import { User } from '@modules/users/users.model';

// ─── Mock Dependencies ──────────────────────────────────────

jest.mock('@modules/users/users.model');
jest.mock('../refresh-token.model', () => {
  const actual = jest.requireActual('../refresh-token.model');
  return {
    ...actual,
    RefreshToken: {
      findOne: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
      deleteOne: jest.fn().mockResolvedValue({}),
    },
  };
});
jest.mock('@shared/config/env', () => ({
  config: {
    jwt: {
      secret: 'test-secret-key',
      expiresIn: '15m',
      refreshSecret: 'test-refresh-secret',
      refreshExpiresIn: '7d',
    },
  },
}));

const UserMock = User as jest.Mocked<typeof User>;
const RefreshTokenMock = RefreshToken as jest.Mocked<typeof RefreshToken>;

// ─── Helpers ─────────────────────────────────────────────────

const mockUser = (overrides = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  name: 'Test User',
  email: 'test@example.com',
  password: 'hashedpassword',
  role: 'user',
  isActive: true,
  comparePassword: jest.fn().mockResolvedValue(true),
  ...overrides,
});

const expectApiError = async (
  fn: () => Promise<unknown>,
  statusCode: number,
  messageSubstring?: string,
) => {
  try {
    await fn();
    fail('Expected error to be thrown');
  } catch (e: any) {
    expect(e).toBeInstanceOf(ApiError);
    expect(e.statusCode).toBe(statusCode);
    if (messageSubstring) {
      expect(e.message).toContain(messageSubstring);
    }
  }
};

// ─── Tests ───────────────────────────────────────────────────

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
    (RefreshTokenMock.create as jest.Mock).mockResolvedValue({});
  });

  // ── Register ───────────────────────────────────────────────

  describe('register', () => {
    it('should register and return accessToken + refreshToken', async () => {
      const user = mockUser();
      (UserMock.findOne as jest.Mock).mockResolvedValue(null);
      (UserMock.create as jest.Mock).mockResolvedValue(user);

      const result = await authService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Strong1pass',
      });

      expect(result.user.id).toBe('507f1f77bcf86cd799439011');
      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
      // Refresh token stored in DB
      expect(RefreshTokenMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '507f1f77bcf86cd799439011',
          token: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      );
    });

    it('should normalise email before querying', async () => {
      (UserMock.findOne as jest.Mock).mockResolvedValue(null);
      (UserMock.create as jest.Mock).mockResolvedValue(mockUser());

      await authService.register({
        name: 'Test',
        email: '  TEST@Example.COM  ',
        password: 'Strong1pass',
      });

      expect(UserMock.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    });

    it('should throw ConflictError (409) if email already registered', async () => {
      (UserMock.findOne as jest.Mock).mockResolvedValue(mockUser());

      await expectApiError(
        () =>
          authService.register({
            name: 'Test',
            email: 'test@example.com',
            password: 'Strong1pass',
          }),
        StatusCodes.CONFLICT,
        'AUTH_001',
      );
    });

    it('should generate accessToken with userId and role only (no email)', async () => {
      (UserMock.findOne as jest.Mock).mockResolvedValue(null);
      (UserMock.create as jest.Mock).mockResolvedValue(mockUser());

      const result = await authService.register({
        name: 'Test',
        email: 'test@example.com',
        password: 'Strong1pass',
      });

      const decoded = jwt.decode(result.accessToken) as Record<string, unknown>;
      expect(decoded.userId).toBe('507f1f77bcf86cd799439011');
      expect(decoded.role).toBe('user');
      expect(decoded).not.toHaveProperty('email');
    });
  });

  // ── Login ──────────────────────────────────────────────────

  describe('login', () => {
    const selectMock = jest.fn();

    beforeEach(() => {
      selectMock.mockReset();
      (UserMock.findOne as jest.Mock).mockReturnValue({ select: selectMock });
    });

    it('should login and return accessToken + refreshToken', async () => {
      const user = mockUser();
      selectMock.mockResolvedValue(user);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'Strong1pass',
      });

      expect(result.user.id).toBe('507f1f77bcf86cd799439011');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(user.comparePassword).toHaveBeenCalledWith('Strong1pass');
      expect(RefreshTokenMock.create).toHaveBeenCalled();
    });

    it('should throw UnauthorizedError (401) if user not found', async () => {
      selectMock.mockResolvedValue(null);

      await expectApiError(
        () => authService.login({ email: 'x@test.com', password: 'any' }),
        StatusCodes.UNAUTHORIZED,
        'AUTH_002',
      );
    });

    it('should throw UnauthorizedError (401) if account is deactivated', async () => {
      selectMock.mockResolvedValue(mockUser({ isActive: false }));

      await expectApiError(
        () => authService.login({ email: 'test@example.com', password: 'Strong1pass' }),
        StatusCodes.UNAUTHORIZED,
        'AUTH_003',
      );
    });

    it('should throw UnauthorizedError (401) if password is wrong', async () => {
      const user = mockUser();
      user.comparePassword.mockResolvedValue(false);
      selectMock.mockResolvedValue(user);

      await expectApiError(
        () => authService.login({ email: 'test@example.com', password: 'wrong' }),
        StatusCodes.UNAUTHORIZED,
        'AUTH_002',
      );
    });

    it('should return same error for wrong email and wrong password (no user enumeration)', async () => {
      // Wrong email
      selectMock.mockResolvedValue(null);
      try {
        await authService.login({ email: 'wrong@test.com', password: 'any' });
      } catch (e: any) {
        expect(e.message).toBe(AUTH_ERRORS.INVALID_CREDENTIALS);
      }

      // Wrong password
      const user = mockUser();
      user.comparePassword.mockResolvedValue(false);
      selectMock.mockResolvedValue(user);
      try {
        await authService.login({ email: 'test@example.com', password: 'wrong' });
      } catch (e: any) {
        expect(e.message).toBe(AUTH_ERRORS.INVALID_CREDENTIALS);
      }
    });
  });

  // ── Refresh ────────────────────────────────────────────────

  describe('refresh', () => {
    it('should issue new accessToken + refreshToken (rotation)', async () => {
      const deleteOneMock = jest.fn().mockResolvedValue({});
      const storedToken = {
        token: 'old-refresh-token',
        userId: '507f1f77bcf86cd799439011',
        expiresAt: new Date(Date.now() + 86400000), // tomorrow
        deleteOne: deleteOneMock,
      };
      (RefreshTokenMock.findOne as jest.Mock).mockResolvedValue(storedToken);
      (UserMock.findById as jest.Mock).mockResolvedValue(mockUser());

      const result = await authService.refresh({ refreshToken: 'old-refresh-token' });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(deleteOneMock).toHaveBeenCalled(); // Old token deleted
      expect(RefreshTokenMock.create).toHaveBeenCalled(); // New token created
    });

    it('should throw UnauthorizedError (401) if refresh token not found', async () => {
      (RefreshTokenMock.findOne as jest.Mock).mockResolvedValue(null);

      await expectApiError(
        () => authService.refresh({ refreshToken: 'nonexistent-token' }),
        StatusCodes.UNAUTHORIZED,
        'AUTH_004',
      );
    });

    it('should throw UnauthorizedError (401) if refresh token is expired', async () => {
      const deleteOneMock = jest.fn().mockResolvedValue({});
      const storedToken = {
        token: 'expired-token',
        userId: '507f1f77bcf86cd799439011',
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
        deleteOne: deleteOneMock,
      };
      (RefreshTokenMock.findOne as jest.Mock).mockResolvedValue(storedToken);

      await expectApiError(
        () => authService.refresh({ refreshToken: 'expired-token' }),
        StatusCodes.UNAUTHORIZED,
        'AUTH_004',
      );
      expect(deleteOneMock).toHaveBeenCalled(); // Expired token cleaned up
    });

    it('should throw UnauthorizedError (401) if user no longer exists', async () => {
      const deleteOneMock = jest.fn().mockResolvedValue({});
      const storedToken = {
        token: 'valid-token',
        userId: '507f1f77bcf86cd799439011',
        expiresAt: new Date(Date.now() + 86400000),
        deleteOne: deleteOneMock,
      };
      (RefreshTokenMock.findOne as jest.Mock).mockResolvedValue(storedToken);
      (UserMock.findById as jest.Mock).mockResolvedValue(null);

      await expectApiError(
        () => authService.refresh({ refreshToken: 'valid-token' }),
        StatusCodes.UNAUTHORIZED,
        'AUTH_004',
      );
      expect(deleteOneMock).toHaveBeenCalled();
    });

    it('should throw UnauthorizedError (401) if user is deactivated', async () => {
      const deleteOneMock = jest.fn().mockResolvedValue({});
      const storedToken = {
        token: 'valid-token',
        userId: '507f1f77bcf86cd799439011',
        expiresAt: new Date(Date.now() + 86400000),
        deleteOne: deleteOneMock,
      };
      (RefreshTokenMock.findOne as jest.Mock).mockResolvedValue(storedToken);
      (UserMock.findById as jest.Mock).mockResolvedValue(mockUser({ isActive: false }));

      await expectApiError(
        () => authService.refresh({ refreshToken: 'valid-token' }),
        StatusCodes.UNAUTHORIZED,
        'AUTH_004',
      );
    });
  });

  // ── Logout ─────────────────────────────────────────────────

  describe('logout', () => {
    it('should delete refresh token from DB', async () => {
      await authService.logout('some-refresh-token');

      expect(RefreshTokenMock.deleteOne).toHaveBeenCalledWith({ token: 'some-refresh-token' });
    });

    it('should not throw even if token does not exist', async () => {
      (RefreshTokenMock.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 0 });

      await expect(authService.logout('nonexistent')).resolves.not.toThrow();
    });
  });

  // ── getMe ──────────────────────────────────────────────────

  describe('getMe', () => {
    it('should return user by ID', async () => {
      const user = mockUser();
      (UserMock.findById as jest.Mock).mockResolvedValue(user);

      const result = await authService.getMe('507f1f77bcf86cd799439011');
      expect(result.email).toBe('test@example.com');
    });

    it('should throw NotFoundError (404) if user does not exist', async () => {
      (UserMock.findById as jest.Mock).mockResolvedValue(null);

      await expectApiError(
        () => authService.getMe('nonexistent_id'),
        StatusCodes.NOT_FOUND,
        'not found',
      );
    });
  });
});
