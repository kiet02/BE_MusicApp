import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller';
import { validate } from '@shared/middlewares/validate.middleware';
import { authMiddleware } from '@shared/middlewares/auth.middleware';
import {
  registerValidation, loginValidation, refreshTokenValidation, googleLoginValidation,
  forgotPasswordValidation, resetPasswordValidation, changePasswordValidation,
} from './auth.validation';
import { AUTH_ERRORS } from './auth.code';

const router = Router();

// ─── Auth Rate Limiter ───────────────────────────────────────
const [rateLimitCode, rateLimitMessage] = AUTH_ERRORS.TOO_MANY_REQUESTS.split('|');
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per window
  message: {
    success: false,
    code: 429,
    message: {
      code: rateLimitCode,
      message: rateLimitMessage,
    },
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Đăng ký, đăng nhập, xác thực người dùng
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Đăng ký tài khoản mới
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Register'
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Email đã tồn tại
 */
router.post('/register', authLimiter, validate(registerValidation), authController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Đăng nhập
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Login'
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Email hoặc mật khẩu không đúng
 */
router.post('/login', authLimiter, validate(loginValidation), authController.login);

/**
 * @swagger
 * /auth/google:
 *   post:
 *     summary: Đăng nhập bằng Google
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Thiếu token hoặc config lỗi
 *       401:
 *         description: Token Google không hợp lệ
 */
router.post('/google', authLimiter, validate(googleLoginValidation), authController.googleLogin);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Làm mới access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token mới
 *       401:
 *         description: Refresh token không hợp lệ
 */
router.post('/refresh', authLimiter, validate(refreshTokenValidation), authController.refresh);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Đăng xuất (revoke refresh token)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 */
router.post('/logout', validate(refreshTokenValidation), authController.logout);

/**
 * @swagger
 * /auth/logout-all:
 *   post:
 *     summary: Đăng xuất tất cả thiết bị
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đã đăng xuất tất cả thiết bị
 *       401:
 *         description: Chưa xác thực
 */
router.post('/logout-all', authMiddleware, authController.logoutAll);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Yêu cầu đặt lại mật khẩu
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Nếu email tồn tại, link reset đã được gửi
 */
router.post('/forgot-password', authLimiter, validate(forgotPasswordValidation), authController.forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Đặt lại mật khẩu bằng token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Mật khẩu đã được đặt lại
 *       400:
 *         description: Token không hợp lệ hoặc hết hạn
 */
router.post('/reset-password', authLimiter, validate(resetPasswordValidation), authController.resetPassword);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Đổi mật khẩu (cần đăng nhập)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Mật khẩu đã được đổi
 *       401:
 *         description: Mật khẩu hiện tại không đúng
 *       400:
 *         description: Mật khẩu mới giống mật khẩu cũ
 */
router.post('/change-password', authMiddleware, validate(changePasswordValidation), authController.changePassword);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Lấy thông tin user hiện tại
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Chưa xác thực
 */
router.get('/me', authMiddleware, authController.getMe);

export default router;
