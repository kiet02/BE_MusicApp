/* eslint-disable @typescript-eslint/no-require-imports */
import jwt from 'jsonwebtoken';
import { AuthService } from '../auth.service';
import { User } from '@modules/users/users.model';
import { RefreshToken } from '../refresh-token.model';
import { authMiddleware } from '@shared/middlewares/auth.middleware';
import { ApiError } from '@shared/utils/api-error';
import { StatusCodes } from 'http-status-codes';
import { Request, Response, NextFunction } from 'express';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║            SECURITY ATTACK SIMULATION TESTS                 ║
 * ║  Tái hiện các kịch bản tấn công phổ biến vào hệ thống auth ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

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

const JWT_SECRET = 'test-secret-key';
const WRONG_SECRET = 'attacker-fake-secret';

const UserMock = User as jest.Mocked<typeof User>;
const RefreshTokenMock = RefreshToken as jest.Mocked<typeof RefreshToken>;

// ─── Helpers ─────────────────────────────────────────────────

const mockUser = (overrides = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  name: 'Victim User',
  email: 'victim@example.com',
  password: 'hashedpassword',
  role: 'user',
  isActive: true,
  comparePassword: jest.fn().mockResolvedValue(true),
  ...overrides,
});

const createMockReq = (overrides = {}): Partial<Request> => ({
  headers: {},
  ...overrides,
});

const createMockRes = (): Partial<Response> => ({});

const createMockNext = (): NextFunction => jest.fn();

const runMiddleware = (req: Partial<Request>) => {
  const next = createMockNext();
  authMiddleware(req as Request, createMockRes() as Response, next);
  return next;
};

// ─── Tests ───────────────────────────────────────────────────

describe('🔴 Security Attack Simulations', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
    (RefreshTokenMock.create as jest.Mock).mockResolvedValue({});
  });

  // ══════════════════════════════════════════════════════════
  // 0. NoSQL / SQL INJECTION — Tấn công chèn truy vấn
  // ══════════════════════════════════════════════════════════

  describe('🔓 Attack: NoSQL Injection', () => {
    const selectMock = jest.fn();

    beforeEach(() => {
      selectMock.mockReset();
      (UserMock.findOne as jest.Mock).mockReturnValue({ select: selectMock });
    });

    // ── 0.1 Tấn công trường email bằng toán tử MongoDB ──

    it('should reject $ne operator injection on email field (Zod layer)', () => {
      /**
       * Attacker gửi: { "email": {"$ne": ""}, "password": "any" }
       * Mục đích: MongoDB query trở thành:
       *   User.findOne({ email: { $ne: "" } })  → trả về USER BẤT KỲ
       *
       * Phòng thủ: Zod z.string() REJECT object → validation fail TRƯỚC khi tới service
       */
      const { loginValidation } = require('../auth.validation');
      const result = loginValidation.body.safeParse({
        email: { $ne: '' },
        password: 'anypassword',
      });

      expect(result.success).toBe(false);
    });

    it('should reject $gt operator injection on email field', () => {
      /**
       * Attacker gửi: { "email": {"$gt": ""}, "password": "x" }
       * Mục đích: User.findOne({ email: { $gt: "" } }) → trả về user có email bất kỳ
       */
      const { loginValidation } = require('../auth.validation');
      const result = loginValidation.body.safeParse({
        email: { $gt: '' },
        password: 'x',
      });

      expect(result.success).toBe(false);
    });

    it('should reject $regex operator injection on email field', () => {
      /**
       * Attacker gửi: { "email": {"$regex": ".*"}, "password": "x" }
       * Mục đích: match TẤT CẢ email
       */
      const { loginValidation } = require('../auth.validation');
      const result = loginValidation.body.safeParse({
        email: { $regex: '.*' },
        password: 'x',
      });

      expect(result.success).toBe(false);
    });

    // ── 0.2 Tấn công trường password bằng toán tử MongoDB ──

    it('should reject $ne operator injection on password field', () => {
      /**
       * Attacker gửi: { "email": "victim@test.com", "password": {"$ne": ""} }
       * Mục đích: bypass password check bằng cách truyền object thay vì string
       *
       * Phòng thủ 2 lớp:
       *   1) Zod z.string() reject object → lỗi validation
       *   2) Ngay cả nếu bypass Zod, comparePassword() nhận object thay vì string
       *      → bcrypt.compare(object, hash) → false
       */
      const { loginValidation } = require('../auth.validation');
      const result = loginValidation.body.safeParse({
        email: 'victim@test.com',
        password: { $ne: '' },
      });

      expect(result.success).toBe(false);
    });

    it('should reject $or/$and injection on password field', () => {
      const { loginValidation } = require('../auth.validation');

      // $or attack
      const resultOr = loginValidation.body.safeParse({
        email: 'victim@test.com',
        password: { $or: [{ $ne: '' }] },
      });
      expect(resultOr.success).toBe(false);

      // $and attack
      const resultAnd = loginValidation.body.safeParse({
        email: 'victim@test.com',
        password: { $and: [{ $gt: '' }] },
      });
      expect(resultAnd.success).toBe(false);
    });

    // ── 0.3 Tấn công trường name trong register ──

    it('should reject NoSQL injection on register name field', () => {
      const { registerValidation } = require('../auth.validation');
      const result = registerValidation.body.safeParse({
        name: { $ne: '' },
        email: 'hack@test.com',
        password: 'Strong1pass',
      });

      expect(result.success).toBe(false);
    });

    // ── 0.4 Tấn công refreshToken ──

    it('should reject NoSQL injection on refreshToken field', () => {
      const { refreshTokenValidation } = require('../auth.validation');

      const result = refreshTokenValidation.body.safeParse({
        refreshToken: { $ne: '' },
      });

      expect(result.success).toBe(false);
    });

    // ── 0.5 Service layer defense — Nếu bypass được validation ──

    it('should not return user even if attacker bypasses validation with $ne on email', async () => {
      /**
       * Giả lập: attacker bằng cách nào đó bypass Zod validation
       * và truyền { $ne: "" } vào email.
       *
       * Test: service nhận giá trị đúng như chuỗi đã transform,
       * không phải object injection trực tiếp vào MongoDB query.
       *
       * Vì service gọi data.email.trim().toLowerCase() → nếu email
       * là object → TypeError ngay lập tức, không bao giờ tới findOne.
       */
      await expect(
        authService.login({
          email: { $ne: '' } as any,
          password: 'any',
        }),
      ).rejects.toThrow(); // TypeError: data.email.trim is not a function
    });

    it('should not return user even if attacker bypasses validation with $ne on password', async () => {
      /**
       * Ngay cả nếu password là object:
       *   1) user.comparePassword({ $ne: "" }) → bcrypt.compare(object, hash)
       *   2) bcrypt.compare chỉ nhận string → fail hoặc return false
       */
      const user = mockUser();
      user.comparePassword.mockResolvedValue(false); // bcrypt rejects non-string
      selectMock.mockResolvedValue(user);

      try {
        await authService.login({
          email: 'victim@example.com',
          password: { $ne: '' } as any,
        });
        fail('Should have thrown');
      } catch (e: any) {
        expect(e.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      }
    });
  });

  describe('🔓 Attack: SQL Injection (sanity check)', () => {
    const selectMock = jest.fn();

    beforeEach(() => {
      selectMock.mockReset();
      (UserMock.findOne as jest.Mock).mockReturnValue({ select: selectMock });
    });

    it('should treat SQL injection payloads as plain strings, not commands', async () => {
      /**
       * Dù project dùng MongoDB (không có SQL), hệ thống vẫn phải
       * xử lý các payload SQL injection như chuỗi bình thường.
       *
       * Mongoose luôn dùng parameterized query → payload chỉ là string.
       */
      const sqlPayloads = [
        "admin' OR '1'='1",
        "admin' OR '1'='1' --",
        "'; DROP TABLE users; --",
        "admin'/*",
        "1' UNION SELECT * FROM users--",
        "admin' AND 1=1--",
      ];

      selectMock.mockResolvedValue(null); // Không tìm thấy user

      for (const payload of sqlPayloads) {
        try {
          await authService.login({ email: payload, password: 'any' });
        } catch (e: any) {
          // Payload được truyền nguyên si vào findOne → không match ai
          expect(e.statusCode).toBe(StatusCodes.UNAUTHORIZED);
        }
      }

      // Mongoose nhận đúng chuỗi payload, không thực thi SQL
      for (let i = 0; i < sqlPayloads.length; i++) {
        expect(UserMock.findOne).toHaveBeenNthCalledWith(i + 1, {
          email: sqlPayloads[i].trim().toLowerCase(),
        });
      }
    });
  });

  // ══════════════════════════════════════════════════════════
  // 1. JWT TAMPERING — Giả mạo token
  // ══════════════════════════════════════════════════════════

  describe('🔓 Attack: JWT Tampering', () => {
    it('should reject token signed with a different secret key', () => {
      // Attacker biết cấu trúc payload nhưng không có secret key
      const forgedToken = jwt.sign(
        { userId: '507f1f77bcf86cd799439011', role: 'admin' },
        WRONG_SECRET,
        { expiresIn: '1h' },
      );

      const next = runMiddleware({
        headers: { authorization: `Bearer ${forgedToken}` },
      });

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: StatusCodes.UNAUTHORIZED }),
      );
    });

    it('should reject token with "none" algorithm (alg: none attack)', () => {
      // Tạo token không có chữ ký — kỹ thuật tấn công cổ điển
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          userId: '507f1f77bcf86cd799439011',
          role: 'admin',
        }),
      ).toString('base64url');
      const forgedToken = `${header}.${payload}.`;

      const next = runMiddleware({
        headers: { authorization: `Bearer ${forgedToken}` },
      });

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: StatusCodes.UNAUTHORIZED }),
      );
    });

    it('should reject completely garbage token', () => {
      const next = runMiddleware({
        headers: { authorization: 'Bearer totally.not.a.valid.jwt.token' },
      });

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: StatusCodes.UNAUTHORIZED }),
      );
    });

    it('should reject empty Bearer token', () => {
      const next = runMiddleware({
        headers: { authorization: 'Bearer ' },
      });

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: StatusCodes.UNAUTHORIZED }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // 2. PRIVILEGE ESCALATION — Leo thang quyền
  // ══════════════════════════════════════════════════════════

  describe('🔓 Attack: Privilege Escalation via JWT', () => {
    it('should not allow user to forge admin role in JWT', () => {
      // User cố gắng tự sign token với role=admin
      const forgedToken = jwt.sign(
        { userId: '507f1f77bcf86cd799439011', role: 'admin' },
        WRONG_SECRET,
      );

      const next = runMiddleware({
        headers: { authorization: `Bearer ${forgedToken}` },
      });

      // Token bị reject vì signature không đúng
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: StatusCodes.UNAUTHORIZED }),
      );
    });

    it('should only trust role from server-signed token, not user input', async () => {
      // Verify: register luôn tạo token với role từ DB, không từ request
      const user = mockUser({ role: 'user' }); // DB luôn trả về role=user
      (UserMock.findOne as jest.Mock).mockResolvedValue(null);
      (UserMock.create as jest.Mock).mockResolvedValue(user);

      const result = await authService.register({
        name: 'Hacker',
        email: 'hack@test.com',
        password: 'Strong1pass',
      } as any);

      const decoded = jwt.decode(result.accessToken) as any;
      expect(decoded.role).toBe('user'); // Không phải admin
    });
  });

  // ══════════════════════════════════════════════════════════
  // 3. USER ENUMERATION — Dò tìm email tồn tại
  // ══════════════════════════════════════════════════════════

  describe('🔓 Attack: User Enumeration', () => {
    const selectMock = jest.fn();

    beforeEach(() => {
      selectMock.mockReset();
      (UserMock.findOne as jest.Mock).mockReturnValue({ select: selectMock });
    });

    it('should return identical error for non-existent email and wrong password', async () => {
      // Attacker thử email random → nếu thông báo khác nhau, biết email tồn tại
      let errorForWrongEmail: any;
      let errorForWrongPassword: any;

      // Case 1: Email không tồn tại
      selectMock.mockResolvedValue(null);
      try {
        await authService.login({ email: 'nonexistent@hack.com', password: 'any' });
      } catch (e) {
        errorForWrongEmail = e;
      }

      // Case 2: Email đúng, password sai
      const user = mockUser();
      user.comparePassword.mockResolvedValue(false);
      selectMock.mockResolvedValue(user);
      try {
        await authService.login({ email: 'victim@example.com', password: 'wrong' });
      } catch (e) {
        errorForWrongPassword = e;
      }

      // Cả 2 phải trả về CÙNG MỘT error message
      expect(errorForWrongEmail.message).toBe(errorForWrongPassword.message);
      expect(errorForWrongEmail.statusCode).toBe(errorForWrongPassword.statusCode);
    });
  });

  // ══════════════════════════════════════════════════════════
  // 4. REFRESH TOKEN REPLAY — Dùng lại token đã xài
  // ══════════════════════════════════════════════════════════

  describe('🔓 Attack: Refresh Token Replay', () => {
    it('should reject reuse of a rotated (already-used) refresh token', async () => {
      // Bước 1: Attacker đánh cắp refresh token
      const stolenToken = 'stolen-refresh-token-abc';

      // Bước 2: Nạn nhân đã dùng token này → hệ thống đã xóa nó
      (RefreshTokenMock.findOne as jest.Mock).mockResolvedValue(null);

      // Bước 3: Attacker thử dùng lại token bị đánh cắp
      try {
        await authService.refresh({ refreshToken: stolenToken });
        fail('Should have thrown');
      } catch (e: any) {
        expect(e).toBeInstanceOf(ApiError);
        expect(e.statusCode).toBe(StatusCodes.UNAUTHORIZED);
        expect(e.message).toContain('AUTH_004');
      }
    });

    it('should reject expired refresh token and clean it up', async () => {
      const deleteOneMock = jest.fn().mockResolvedValue({});
      const expiredToken = {
        token: 'expired-token',
        userId: '507f1f77bcf86cd799439011',
        expiresAt: new Date(Date.now() - 86400000), // Hết hạn 1 ngày trước
        deleteOne: deleteOneMock,
      };
      (RefreshTokenMock.findOne as jest.Mock).mockResolvedValue(expiredToken);

      try {
        await authService.refresh({ refreshToken: 'expired-token' });
        fail('Should have thrown');
      } catch (e: any) {
        expect(e.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      }

      // Token hết hạn phải được dọn dẹp khỏi DB
      expect(deleteOneMock).toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════
  // 5. ACCOUNT TAKEOVER — Chiếm tài khoản bị vô hiệu hóa
  // ══════════════════════════════════════════════════════════

  describe('🔓 Attack: Account Takeover on Deactivated Account', () => {
    it('should reject refresh token if account was deactivated after token was issued', async () => {
      // Admin vô hiệu hóa tài khoản, nhưng attacker vẫn giữ refresh token
      const deleteOneMock = jest.fn().mockResolvedValue({});
      const validToken = {
        token: 'valid-token',
        userId: '507f1f77bcf86cd799439011',
        expiresAt: new Date(Date.now() + 86400000),
        deleteOne: deleteOneMock,
      };
      (RefreshTokenMock.findOne as jest.Mock).mockResolvedValue(validToken);
      (UserMock.findById as jest.Mock).mockResolvedValue(mockUser({ isActive: false }));

      try {
        await authService.refresh({ refreshToken: 'valid-token' });
        fail('Should have thrown');
      } catch (e: any) {
        expect(e.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      }

      // Token phải bị xóa khi phát hiện account bị khóa
      expect(deleteOneMock).toHaveBeenCalled();
    });

    it('should reject refresh token if user was deleted from database', async () => {
      const deleteOneMock = jest.fn().mockResolvedValue({});
      const validToken = {
        token: 'orphan-token',
        userId: 'deleted-user-id',
        expiresAt: new Date(Date.now() + 86400000),
        deleteOne: deleteOneMock,
      };
      (RefreshTokenMock.findOne as jest.Mock).mockResolvedValue(validToken);
      (UserMock.findById as jest.Mock).mockResolvedValue(null); // User đã bị xóa

      try {
        await authService.refresh({ refreshToken: 'orphan-token' });
        fail('Should have thrown');
      } catch (e: any) {
        expect(e.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      }

      expect(deleteOneMock).toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════
  // 6. BRUTE FORCE / VÉT CẠN — Tấn công thử mật khẩu bằng vét cạn
  // ══════════════════════════════════════════════════════════

  describe('🔓 Attack: Brute Force — Tấn công vét cạn mật khẩu', () => {
    const selectMock = jest.fn();

    beforeEach(() => {
      selectMock.mockReset();
      (UserMock.findOne as jest.Mock).mockReturnValue({ select: selectMock });
    });

    // ── 6.1 Dictionary Attack — Tấn công từ điển ──────────

    it('should reject top 20 most common passwords (dictionary attack)', async () => {
      const user = mockUser();
      user.comparePassword.mockResolvedValue(false);
      selectMock.mockResolvedValue(user);

      // Top 20 mật khẩu phổ biến nhất từ các vụ leak
      const top20Passwords = [
        '123456',
        'password',
        '123456789',
        '12345678',
        '12345',
        '1234567',
        '1234567890',
        'qwerty',
        'abc123',
        'million2',
        '000000',
        '1234',
        'iloveyou',
        'aaron431',
        'password1',
        'qqww1122',
        '123',
        'omgpop',
        '123321',
        '654321',
      ];

      const errors: any[] = [];

      for (const pw of top20Passwords) {
        try {
          await authService.login({ email: 'victim@example.com', password: pw });
          fail(`Should have rejected password: ${pw}`);
        } catch (e: any) {
          errors.push(e);
        }
      }

      // TẤT CẢ phải bị từ chối
      expect(errors).toHaveLength(top20Passwords.length);
      // TẤT CẢ phải trả cùng error code (không lộ thông tin nào khác)
      errors.forEach((e) => {
        expect(e.statusCode).toBe(StatusCodes.UNAUTHORIZED);
        expect(e.message).toContain('AUTH_002');
      });
    });

    // ── 6.2 Sequential Pattern Attack — Vét cạn tuần tự ──

    it('should reject sequential/pattern password attempts', async () => {
      const user = mockUser();
      user.comparePassword.mockResolvedValue(false);
      selectMock.mockResolvedValue(user);

      // Attacker thử vét cạn các pattern phổ biến
      const patterns = [
        // Số tuần tự
        '000000',
        '111111',
        '222222',
        '333333',
        '999999',
        // Bàn phím
        'qwerty',
        'asdfgh',
        'zxcvbn',
        'qazwsx',
        // Tên + số
        'admin1',
        'user123',
        'test1234',
        'root00',
        // Ngày tháng
        '010101',
        '123456',
        '200000',
        '199999',
        // Lặp lại
        'aaaaaa',
        'abcabc',
        'ababab',
      ];

      let rejectedCount = 0;

      for (const pw of patterns) {
        try {
          await authService.login({ email: 'victim@example.com', password: pw });
        } catch (e: any) {
          rejectedCount++;
          expect(e.statusCode).toBe(StatusCodes.UNAUTHORIZED);
        }
      }

      expect(rejectedCount).toBe(patterns.length);
    });

    // ── 6.3 Credential Stuffing — Nhồi credential bị leak ──

    it('should reject credential stuffing from leaked databases', async () => {
      const user = mockUser();
      user.comparePassword.mockResolvedValue(false);
      selectMock.mockResolvedValue(user);

      // Giả lập attacker dùng combo email:password từ vụ leak khác
      const leakedCredentials = [
        { email: 'victim@example.com', password: 'leaked_pass_1' },
        { email: 'victim@example.com', password: 'leaked_pass_2' },
        { email: 'victim@example.com', password: 'myOldPassword123' },
        { email: 'victim@example.com', password: 'Summer2024!' },
        { email: 'victim@example.com', password: 'P@ssw0rd' },
      ];

      for (const cred of leakedCredentials) {
        try {
          await authService.login(cred);
        } catch (e: any) {
          // Mỗi lần thử đều không lộ thêm thông tin
          expect(e.statusCode).toBe(StatusCodes.UNAUTHORIZED);
          expect(e.message).toContain('AUTH_002');
        }
      }

      // Xác nhận comparePassword được gọi → hệ thống không short-circuit
      expect(user.comparePassword).toHaveBeenCalledTimes(leakedCredentials.length);
    });

    // ── 6.4 Exhaustive Short Password Scan — Vét cạn mật khẩu ngắn ──

    it('should reject all 4-character lowercase combinations (sample)', async () => {
      const user = mockUser();
      user.comparePassword.mockResolvedValue(false);
      selectMock.mockResolvedValue(user);

      // Vét cạn tất cả 4 ký tự a-z (mẫu nhỏ — thực tế là 26^4 = 456,976 tổ hợp)
      // Test đại diện: thử 50 tổ hợp ngẫu nhiên
      const chars = 'abcdefghijklmnopqrstuvwxyz';
      const attempts: string[] = [];

      for (let i = 0; i < 50; i++) {
        let pw = '';
        for (let j = 0; j < 4; j++) {
          pw += chars[Math.floor(Math.random() * chars.length)];
        }
        attempts.push(pw);
      }

      let allRejected = true;
      for (const pw of attempts) {
        try {
          await authService.login({ email: 'victim@example.com', password: pw });
          allRejected = false;
        } catch (e: any) {
          expect(e.statusCode).toBe(StatusCodes.UNAUTHORIZED);
        }
      }

      expect(allRejected).toBe(true);
      expect(user.comparePassword).toHaveBeenCalledTimes(attempts.length);
    });

    // ── 6.5 Timing Consistency — Đồng nhất thời gian phản hồi ──

    it('should have consistent error response regardless of whether email exists', async () => {
      // Attacker đo thời gian phản hồi:
      //   - Nếu email không tồn tại → trả lỗi nhanh (không gọi bcrypt)
      //   - Nếu email tồn tại → trả lỗi chậm (có gọi bcrypt)
      //   → Lộ email nào tồn tại trong hệ thống

      // Case 1: Email không tồn tại — service trả lỗi TRƯỚC khi gọi comparePassword
      selectMock.mockResolvedValue(null);
      let errorNoUser: any;
      try {
        await authService.login({ email: 'ghost@example.com', password: 'any' });
      } catch (e) {
        errorNoUser = e;
      }

      // Case 2: Email tồn tại nhưng password sai
      const user = mockUser();
      user.comparePassword.mockResolvedValue(false);
      selectMock.mockResolvedValue(user);
      let errorWrongPw: any;
      try {
        await authService.login({ email: 'victim@example.com', password: 'wrong' });
      } catch (e) {
        errorWrongPw = e;
      }

      // Cả 2 phải có CÙNG statusCode VÀ CÙNG message
      // → Attacker không thể phân biệt bằng nội dung response
      expect(errorNoUser.statusCode).toBe(errorWrongPw.statusCode);
      expect(errorNoUser.message).toBe(errorWrongPw.message);

      // Lưu ý: timing attack qua thời gian phản hồi là một vấn đề riêng
      // cần xử lý ở tầng infrastructure (rate limit đã giúp giảm thiểu)
    });

    // ── 6.6 Password Spray — Dùng 1 mật khẩu thử nhiều email ──

    it('should reject password spray attack across multiple accounts', async () => {
      const user = mockUser();
      user.comparePassword.mockResolvedValue(false);
      selectMock.mockResolvedValue(user);

      // Attacker dùng 1 mật khẩu phổ biến thử trên nhiều email
      const targetEmails = [
        'alice@company.com',
        'bob@company.com',
        'charlie@company.com',
        'admin@company.com',
        'ceo@company.com',
        'hr@company.com',
        'finance@company.com',
        'it@company.com',
      ];

      const sprayPassword = 'Company2024!';

      for (const email of targetEmails) {
        try {
          await authService.login({ email, password: sprayPassword });
        } catch (e: any) {
          expect(e.statusCode).toBe(StatusCodes.UNAUTHORIZED);
          expect(e.message).toContain('AUTH_002');
        }
      }

      // Mỗi email đều được kiểm tra → không có bypass
      expect(UserMock.findOne).toHaveBeenCalledTimes(targetEmails.length);
    });
  });

  // ══════════════════════════════════════════════════════════
  // 7. HEADER MANIPULATION — Thao túng header
  // ══════════════════════════════════════════════════════════

  describe('🔓 Attack: Header Manipulation', () => {
    it('should reject request with no Authorization header', () => {
      const next = runMiddleware({ headers: {} });

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: StatusCodes.UNAUTHORIZED }),
      );
    });

    it('should reject "Basic" auth scheme (only Bearer allowed)', () => {
      const credentials = Buffer.from('user:pass').toString('base64');
      const next = runMiddleware({
        headers: { authorization: `Basic ${credentials}` },
      });

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: StatusCodes.UNAUTHORIZED }),
      );
    });

    it('should reject "bearer" with wrong casing', () => {
      const token = jwt.sign({ userId: 'x', role: 'user' }, JWT_SECRET);
      const next = runMiddleware({
        headers: { authorization: `bearer ${token}` }, // lowercase 'b'
      });

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: StatusCodes.UNAUTHORIZED }),
      );
    });

    it('should reject token with extra spaces in Bearer prefix', () => {
      const token = jwt.sign({ userId: 'x', role: 'user' }, JWT_SECRET);
      const next = runMiddleware({
        headers: { authorization: `Bearer  ${token}` }, // Double space
      });

      // jwt.verify sẽ fail vì token bắt đầu bằng space
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: StatusCodes.UNAUTHORIZED }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // 8. EXPIRED TOKEN — Dùng token quá hạn
  // ══════════════════════════════════════════════════════════

  describe('🔓 Attack: Expired Access Token', () => {
    it('should reject an expired access token', () => {
      // Tạo token đã hết hạn 1 giờ trước
      const expiredToken = jwt.sign(
        { userId: '507f1f77bcf86cd799439011', role: 'user' },
        JWT_SECRET,
        { expiresIn: '-1h' } as any,
      );

      const next = runMiddleware({
        headers: { authorization: `Bearer ${expiredToken}` },
      });

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: StatusCodes.UNAUTHORIZED }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // 9. JWT PAYLOAD INSPECTION — Kiểm tra token không lộ PII
  // ══════════════════════════════════════════════════════════

  describe('🔒 Defense: JWT Minimal Payload', () => {
    it('should NOT expose email in access token', async () => {
      const user = mockUser();
      (UserMock.findOne as jest.Mock).mockResolvedValue(null);
      (UserMock.create as jest.Mock).mockResolvedValue(user);

      const result = await authService.register({
        name: 'Test',
        email: 'test@example.com',
        password: 'Strong1pass',
      });

      const decoded = jwt.decode(result.accessToken) as any;
      expect(decoded).not.toHaveProperty('email');
      expect(decoded).not.toHaveProperty('password');
      expect(decoded).not.toHaveProperty('name');
      // Chỉ có userId, role, iat, exp
      expect(Object.keys(decoded).sort()).toEqual(['exp', 'iat', 'role', 'userId']);
    });

    it('should NOT use email as refresh token (must be random opaque string)', async () => {
      const user = mockUser();
      (UserMock.findOne as jest.Mock).mockResolvedValue(null);
      (UserMock.create as jest.Mock).mockResolvedValue(user);

      const result = await authService.register({
        name: 'Test',
        email: 'test@example.com',
        password: 'Strong1pass',
      });

      // Refresh token phải là chuỗi hex ngẫu nhiên, không phải JWT hay email
      expect(result.refreshToken).not.toContain('@');
      expect(result.refreshToken).not.toContain('.');
      expect(result.refreshToken).toMatch(/^[a-f0-9]{80}$/); // 40 bytes = 80 hex chars
    });
  });

  // ══════════════════════════════════════════════════════════
  // 10. LOGOUT COMPLETENESS — Đăng xuất thực sự revoke token
  // ══════════════════════════════════════════════════════════

  describe('🔒 Defense: Logout Revocation', () => {
    it('should make refresh token unusable after logout', async () => {
      // Bước 1: Logout → token bị xóa khỏi DB
      await authService.logout('my-refresh-token');
      expect(RefreshTokenMock.deleteOne).toHaveBeenCalledWith({ token: 'my-refresh-token' });

      // Bước 2: Thử dùng lại token sau khi logout → findOne trả về null
      (RefreshTokenMock.findOne as jest.Mock).mockResolvedValue(null);

      try {
        await authService.refresh({ refreshToken: 'my-refresh-token' });
        fail('Should have thrown');
      } catch (e: any) {
        expect(e.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      }
    });
  });
});
