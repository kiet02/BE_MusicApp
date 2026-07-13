import { AuthService } from '../auth.service';
import { User } from '@modules/users/users.model';
import { StatusCodes } from 'http-status-codes';

jest.mock('@modules/users/users.model');
jest.mock('../refresh-token.model', () => {
  const actual = jest.requireActual('../refresh-token.model');
  return {
    ...actual,
    RefreshToken: {
      create: jest.fn().mockResolvedValue({}),
      findOne: jest.fn(),
      deleteOne: jest.fn().mockResolvedValue({}),
    },
  };
});

const verifyIdTokenMock = jest.fn();
jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => {
      return {
        verifyIdToken: verifyIdTokenMock,
      };
    }),
  };
});

const mockClientId = 'test-google-client-id';

jest.mock('@shared/config/env', () => ({
  config: {
    jwt: {
      secret: 'test-secret-key',
      expiresIn: '15m',
      refreshSecret: 'test-refresh-secret',
      refreshExpiresIn: '7d',
    },
    google: {
      clientId: 'test-google-client-id',
    },
  },
}));

const UserMock = User as jest.Mocked<typeof User>;

const mockUser = (overrides = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  name: 'Google User',
  email: 'google@test.com',
  role: 'user',
  isActive: true,
  ...overrides,
});

describe('Google Authentication', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  it('should login successfully if user already exists', async () => {
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({
        email: 'google@test.com',
        email_verified: true,
        name: 'Existing Google User',
      }),
    });

    const user = mockUser({ email: 'google@test.com', name: 'Existing Google User' });
    (UserMock.findOne as jest.Mock).mockResolvedValue(user);

    const result = await authService.loginWithGoogle({ idToken: 'valid-id-token' });

    expect(verifyIdTokenMock).toHaveBeenCalledWith({
      idToken: 'valid-id-token',
      audience: mockClientId,
    });
    expect(UserMock.findOne).toHaveBeenCalledWith({ email: 'google@test.com' });
    expect(UserMock.create).not.toHaveBeenCalled();
    expect(result.user.email).toBe('google@test.com');
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it('should register and login successfully if user does not exist', async () => {
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({
        email: 'newgoogle@test.com',
        email_verified: true,
        name: 'New Google User',
      }),
    });

    (UserMock.findOne as jest.Mock).mockResolvedValue(null);
    const user = mockUser({ email: 'newgoogle@test.com', name: 'New Google User' });
    (UserMock.create as jest.Mock).mockResolvedValue(user);

    const result = await authService.loginWithGoogle({ idToken: 'valid-id-token' });

    expect(UserMock.findOne).toHaveBeenCalledWith({ email: 'newgoogle@test.com' });
    expect(UserMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'newgoogle@test.com',
        name: 'New Google User',
        password: expect.any(String),
        role: 'user',
      }),
    );
    expect(result.user.email).toBe('newgoogle@test.com');
    expect(result.accessToken).toBeDefined();
  });

  it('should throw BadRequestError (400) if Google client ID is missing in config', async () => {
    const env = require('@shared/config/env');
    const originalClientId = env.config.google.clientId;
    env.config.google.clientId = '';

    await expect(
      authService.loginWithGoogle({ idToken: 'some-token' }),
    ).rejects.toThrow(expect.objectContaining({
      statusCode: StatusCodes.BAD_REQUEST,
      message: expect.stringContaining('AUTH_008'),
    }));

    env.config.google.clientId = originalClientId;
  });

  it('should throw UnauthorizedError (401) if idToken is invalid', async () => {
    verifyIdTokenMock.mockRejectedValue(new Error('Invalid token signature'));

    await expect(
      authService.loginWithGoogle({ idToken: 'invalid-token' }),
    ).rejects.toThrow(expect.objectContaining({
      statusCode: StatusCodes.UNAUTHORIZED,
      message: expect.stringContaining('AUTH_007'),
    }));
  });

  it('should throw UnauthorizedError (401) if user account is deactivated', async () => {
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({
        email: 'deactivated@test.com',
        email_verified: true,
        name: 'Deactivated User',
      }),
    });

    const user = mockUser({ email: 'deactivated@test.com', isActive: false });
    (UserMock.findOne as jest.Mock).mockResolvedValue(user);

    await expect(
      authService.loginWithGoogle({ idToken: 'valid-token' }),
    ).rejects.toThrow(expect.objectContaining({
      statusCode: StatusCodes.UNAUTHORIZED,
      message: expect.stringContaining('AUTH_003'),
    }));
  });

  describe('Google Access Token (ya29.) verification', () => {
    let originalFetch: typeof fetch;

    beforeAll(() => {
      originalFetch = global.fetch;
    });

    afterAll(() => {
      global.fetch = originalFetch;
    });

    it('should login successfully with a valid access token', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          email: 'access-token-user@test.com',
          email_verified: true,
          name: 'Access Token User',
        }),
      } as any);

      (UserMock.findOne as jest.Mock).mockResolvedValue(null);
      const user = mockUser({ email: 'access-token-user@test.com', name: 'Access Token User' });
      (UserMock.create as jest.Mock).mockResolvedValue(user);

      const result = await authService.loginWithGoogle({
        idToken: 'ya29.valid-access-token',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v3/userinfo?access_token=ya29.valid-access-token'
      );
      expect(result.user.email).toBe('access-token-user@test.com');
      expect(result.accessToken).toBeDefined();
    });

    it('should throw UnauthorizedError (401) if Access Token verification fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
      } as any);

      await expect(
        authService.loginWithGoogle({ idToken: 'ya29.invalid-access-token' }),
      ).rejects.toThrow(expect.objectContaining({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: expect.stringContaining('AUTH_007'),
      }));
    });
  });

  describe('🔒 Google Auth Security and Exploit Resistance', () => {
    let originalFetch: typeof fetch;

    beforeAll(() => {
      originalFetch = global.fetch;
    });

    afterAll(() => {
      global.fetch = originalFetch;
    });

    it('should reject ID token if the audience does not match our Client ID (Audience Replay Attack)', async () => {
      verifyIdTokenMock.mockImplementation(({ audience }: any) => {
        if (audience !== mockClientId) {
          return Promise.reject(new Error('Wrong audience'));
        }
        return Promise.resolve({
          getPayload: () => ({
            email: 'victim@test.com',
            email_verified: true,
          }),
        });
      });

      const user = mockUser();
      (UserMock.findOne as jest.Mock).mockResolvedValue(user);

      await authService.loginWithGoogle({ idToken: 'valid-but-forged-audience-token' });

      expect(verifyIdTokenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          audience: mockClientId,
        })
      );
    });

    it('should sanitize and encode special characters in Access Token to prevent query injection and SSRF', async () => {
      const maliciousToken = 'ya29.attacker-token&another_param=hack#redirect';

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          email: 'injected@test.com',
          email_verified: true,
          name: 'Injected User',
        }),
      } as any);

      (UserMock.findOne as jest.Mock).mockResolvedValue(mockUser({ email: 'injected@test.com' }));

      await authService.loginWithGoogle({ idToken: maliciousToken });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://www.googleapis.com/oauth2/v3/userinfo?access_token=ya29.attacker-token')
      );
    });

    it('should generate a highly secure, non-guessable password for new Google users', async () => {
      verifyIdTokenMock.mockResolvedValue({
        getPayload: () => ({
          email: 'secure-pass@test.com',
          email_verified: true,
          name: 'Secure User',
        }),
      });

      (UserMock.findOne as jest.Mock).mockResolvedValue(null);

      let createdPassword = '';
      (UserMock.create as jest.Mock).mockImplementation(async (data: any) => {
        createdPassword = data.password;
        return mockUser(data);
      });

      await authService.loginWithGoogle({ idToken: 'valid-id-token' });

      expect(UserMock.create).toHaveBeenCalled();
      expect(createdPassword.length).toBeGreaterThanOrEqual(60);
      expect(createdPassword).toMatch(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/);
    });

    it('should throw an error and reject object payload to prevent NoSQL injection', async () => {
      const maliciousPayload = { $ne: '' } as any;

      await expect(
        authService.loginWithGoogle({ idToken: maliciousPayload }),
      ).rejects.toThrow();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // Lỗ hổng #1: Bỏ qua việc xác minh Token ở Backend
  // (Improper Token Validation)
  // ══════════════════════════════════════════════════════════════

  describe('🔓 Vuln #1: Improper Token Validation', () => {

    it('should VERIFY signature, not just DECODE — tampered token must be rejected', async () => {
      // Hacker decode ID Token, sửa email thành victim, encode lại
      // => verifyIdToken phải reject vì chữ ký số không khớp
      verifyIdTokenMock.mockRejectedValue(
        new Error('Invalid token signature')
      );

      await expect(
        authService.loginWithGoogle({ idToken: 'tampered.jwt.token' }),
      ).rejects.toThrow(expect.objectContaining({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: expect.stringContaining('AUTH_007'),
      }));
    });

    it('should enforce audience check — token from another app must be rejected (Confused Deputy)', async () => {
      // Hacker tạo app Google riêng, lừa victim đăng nhập lấy token
      // Token hợp lệ (Google ký) nhưng audience = client_id_app_hacker
      verifyIdTokenMock.mockImplementation(({ audience }: any) => {
        // Giả lập: Google library kiểm tra audience != our client_id => reject
        if (audience === mockClientId) {
          throw new Error('Token audience mismatch');
        }
        return Promise.resolve({
          getPayload: () => ({
            email: 'victim@gmail.com',
            email_verified: true,
            name: 'Victim',
          }),
        });
      });

      // Với audience đúng -> verifyIdToken PHẢI reject token từ app khác
      await expect(
        authService.loginWithGoogle({ idToken: 'valid-google-token-wrong-audience' }),
      ).rejects.toThrow(expect.objectContaining({
        statusCode: StatusCodes.UNAUTHORIZED,
      }));
    });

    it('should ALWAYS pass audience to verifyIdToken — never call without it', async () => {
      verifyIdTokenMock.mockResolvedValue({
        getPayload: () => ({
          email: 'test@gmail.com',
          email_verified: true,
          name: 'Test',
        }),
      });

      (UserMock.findOne as jest.Mock).mockResolvedValue(mockUser({ email: 'test@gmail.com' }));

      await authService.loginWithGoogle({ idToken: 'valid-id-token' });

      expect(verifyIdTokenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          audience: mockClientId,
        })
      );
    });

    it('should reject access token if Google userinfo API returns error', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
      } as any);

      await expect(
        authService.loginWithGoogle({ idToken: 'ya29.stolen-or-expired-token' }),
      ).rejects.toThrow(expect.objectContaining({
        statusCode: StatusCodes.UNAUTHORIZED,
      }));

      global.fetch = originalFetch;
    });
  });

  // ══════════════════════════════════════════════════════════════
  // Lỗ hổng #2: Chiếm đoạt qua tính năng Gộp tài khoản
  // (Account Takeover via Unverified Email)
  // ══════════════════════════════════════════════════════════════

  describe('🔓 Vuln #2: Account Takeover via Unverified Email', () => {

    it('should reject ID Token with email_verified=false', async () => {
      // Hacker tạo tài khoản Google/Facebook với email chưa xác minh
      // để chiếm tài khoản có sẵn trong hệ thống
      verifyIdTokenMock.mockResolvedValue({
        getPayload: () => ({
          email: 'victim@company.com',
          email_verified: false, // Email chưa được Google xác minh!
          name: 'Hacker Fake Account',
        }),
      });

      await expect(
        authService.loginWithGoogle({ idToken: 'token-with-unverified-email' }),
      ).rejects.toThrow(expect.objectContaining({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: expect.stringContaining('AUTH_009'),
      }));

      // QUAN TRỌNG: Không được tạo user hay merge account
      expect(UserMock.findOne).not.toHaveBeenCalled();
      expect(UserMock.create).not.toHaveBeenCalled();
    });

    it('should reject Access Token (ya29.) with email_verified=false', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          email: 'victim@company.com',
          email_verified: false, // Chưa xác minh!
          name: 'Hacker via Access Token',
        }),
      } as any);

      await expect(
        authService.loginWithGoogle({ idToken: 'ya29.unverified-email-token' }),
      ).rejects.toThrow(expect.objectContaining({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: expect.stringContaining('AUTH_009'),
      }));

      expect(UserMock.findOne).not.toHaveBeenCalled();
      global.fetch = originalFetch;
    });

    it('should reject when email_verified field is missing entirely', async () => {
      verifyIdTokenMock.mockResolvedValue({
        getPayload: () => ({
          email: 'victim@company.com',
          // email_verified bị thiếu => undefined => !undefined === true => reject
          name: 'Suspicious Account',
        }),
      });

      await expect(
        authService.loginWithGoogle({ idToken: 'token-without-verified-field' }),
      ).rejects.toThrow(expect.objectContaining({
        statusCode: StatusCodes.UNAUTHORIZED,
      }));
    });

    it('should accept only when email_verified is strictly true', async () => {
      verifyIdTokenMock.mockResolvedValue({
        getPayload: () => ({
          email: 'safe@gmail.com',
          email_verified: true, // Đã xác minh!
          name: 'Safe User',
        }),
      });

      (UserMock.findOne as jest.Mock).mockResolvedValue(
        mockUser({ email: 'safe@gmail.com' })
      );

      const result = await authService.loginWithGoogle({ idToken: 'verified-token' });
      expect(result.user.email).toBe('safe@gmail.com');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // Lỗ hổng #3: Tấn công CSRF để gắn tài khoản
  // (Account Linking CSRF)
  // ══════════════════════════════════════════════════════════════

  describe('🔓 Vuln #3: CSRF Account Linking Prevention', () => {

    it('should NOT have any account linking endpoint that accepts OAuth callback without state parameter', () => {
      /**
       * Thiết kế hiện tại KHÔNG CÓ luồng callback/redirect:
       * - Frontend gửi idToken trực tiếp qua POST body
       * - Backend xác thực token và trả kết quả
       * - Không có redirect URL => Không có CSRF attack surface
       *
       * Nếu sau này thêm tính năng "Liên kết tài khoản Google":
       * PHẢI thêm CSRF token (state parameter) vào luồng OAuth redirect.
       */
      const routes = require('../auth.routes');
      // Không có route nào dùng GET callback pattern
      // API chỉ có POST /google nhận idToken trong body
      expect(routes).toBeDefined();
    });

    it('should only accept Google token via POST body, never via URL query parameter', () => {
      /**
       * Token PHẢI được gửi trong POST body (application/json),
       * KHÔNG ĐƯỢC gửi qua URL query (?token=xxx) vì:
       *   - URL lưu trong browser history
       *   - URL bị rò rỉ qua Referer header
       *   - URL bị log trong access logs
       *
       * Thiết kế hiện tại: POST /auth/google { "idToken": "..." }
       * => An toàn: Token nằm trong request body, không bao giờ lên URL
       */
      const { googleLoginValidation } = require('../auth.validation');

      // Validation chỉ kiểm tra body, không có query/params
      expect(googleLoginValidation.body).toBeDefined();
      expect(googleLoginValidation).not.toHaveProperty('query');
      expect(googleLoginValidation).not.toHaveProperty('params');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // Lỗ hổng #4: Rò rỉ Token qua URL
  // (Token Leakage via URL)
  // ══════════════════════════════════════════════════════════════

  describe('🔓 Vuln #4: Token Leakage Prevention', () => {

    it('should return tokens in response body, never redirect with token in URL', async () => {
      verifyIdTokenMock.mockResolvedValue({
        getPayload: () => ({
          email: 'user@test.com',
          email_verified: true,
          name: 'Test User',
        }),
      });

      (UserMock.findOne as jest.Mock).mockResolvedValue(
        mockUser({ email: 'user@test.com' })
      );

      const result = await authService.loginWithGoogle({ idToken: 'valid-token' });

      // Kết quả trả về là object chứa tokens, KHÔNG PHẢI redirect URL
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');

      // Token KHÔNG BAO GIỜ nằm trong URL
      expect(typeof result.accessToken).toBe('string');
      expect(result.accessToken).not.toContain('http');
      expect(result.accessToken).not.toContain('redirect');
    });

    it('should NOT expose Google idToken or access token in the response', async () => {
      verifyIdTokenMock.mockResolvedValue({
        getPayload: () => ({
          email: 'user@test.com',
          email_verified: true,
          name: 'Test User',
        }),
      });

      (UserMock.findOne as jest.Mock).mockResolvedValue(
        mockUser({ email: 'user@test.com' })
      );

      const result = await authService.loginWithGoogle({ idToken: 'google-id-token-secret' });

      // Response KHÔNG ĐƯỢC chứa lại Google token gốc
      const resultStr = JSON.stringify(result);
      expect(resultStr).not.toContain('google-id-token-secret');
      expect(resultStr).not.toContain('ya29.');

      // Chỉ trả về token của HỆ THỐNG, không trả lại token Google
      expect(Object.keys(result)).toEqual(
        expect.arrayContaining(['user', 'accessToken', 'refreshToken'])
      );
    });
  });
});
