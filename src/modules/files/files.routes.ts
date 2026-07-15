import { Router } from 'express';
import * as filesController from './files.controller';
import { authMiddleware } from '../../shared/middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Files
 *   description: API quản lý file và upload (Giao tiếp với MinIO)
 */

/**
 * @swagger
 * /files/generate-minio-url:
 *   post:
 *     summary: Tạo presigned URL để client upload trực tiếp lên MinIO
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileName
 *               - contentType
 *             properties:
 *               fileName:
 *                 type: string
 *                 example: song.mp3
 *               contentType:
 *                 type: string
 *                 example: audio/mpeg
 *     responses:
 *       200:
 *         description: Trả về URL upload (dùng phương thức PUT) và URL truy cập công khai.
 */
router.post('/generate-minio-url', authMiddleware, filesController.generateMinioUrl);

/**
 * @swagger
 * /files/save-song-db:
 *   post:
 *     summary: Lưu thông tin bài hát vào Database (Mô phỏng)
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - audioUrl
 *             properties:
 *               title:
 *                 type: string
 *               audioUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lưu thành công
 */
router.post('/save-song-db', authMiddleware, filesController.saveSongDb);

export default router;
