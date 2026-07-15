import { Router } from 'express';
import * as chatController from './chat.controller';
import { authMiddleware } from '../../shared/middlewares/auth.middleware';

const router = Router();

// Protect all chat routes
router.use(authMiddleware);

// Tạo hoặc lấy phòng chat giữa 2 user
router.post('/conversations', chatController.createOrGetConversation);

// Lấy danh sách phòng chat của 1 user
router.get('/conversations', chatController.getConversations);

// Lấy lịch sử tin nhắn của 1 phòng chat
router.get('/conversations/:id/messages', chatController.getMessages);

// ─── GROUP CHAT ───
router.post('/groups', chatController.createGroup);
router.post('/groups/:id/members', chatController.addMember);
router.delete('/groups/:id/members', chatController.removeMember);

export default router;
