import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { chatService } from './chat.service';
import { logger } from '../../shared/utils/logger';
/**
 * POST /api/v1/chat/conversations
 * Body: { userId, participantId }
 * Tạo hoặc lấy phòng chat giữa 2 user.
 */
export const createOrGetConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'participantId is required',
      });
    }

    const conversation = await chatService.getOrCreateConversation(userId, participantId);

    res.status(StatusCodes.OK).json({
      success: true,
      data: conversation,
    });
  } catch (error: any) {
    logger.error('Error in createOrGetConversation:', error);
    if (error.message === 'Cannot create a conversation with yourself') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * GET /api/v1/chat/conversations?userId=xxx
 * Lấy danh sách phòng chat của 1 user.
 */
export const getConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const conversations = await chatService.getConversations(userId);

    res.status(StatusCodes.OK).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    logger.error('Error in getConversations:', error);
    next(error);
  }
};

/**
 * GET /api/v1/chat/conversations/:id/messages?page=1&limit=30
 * Lấy lịch sử tin nhắn của 1 phòng chat (phân trang).
 */
export const getMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversationId = req.params.id as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;

    const result = await chatService.getMessages(conversationId, page, limit);

    res.status(StatusCodes.OK).json({
      success: true,
      data: result.messages,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Error in getMessages:', error);
    next(error);
  }
};

// ─── GROUP CHAT ──────────────────────────────────────────────

/**
 * POST /api/v1/chat/groups
 * Body: { groupName, memberIds: string[] }
 */
export const createGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupName, memberIds } = req.body;

    if (!groupName || !memberIds || !Array.isArray(memberIds)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'groupName and memberIds (array) are required',
      });
    }

    const conversation = await chatService.createGroupConversation(groupName, memberIds);

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: conversation,
    });
  } catch (error: any) {
    logger.error('Error in createGroup:', error);
    res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/v1/chat/groups/:id/members
 * Body: { userId }
 */
export const addMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversationId = req.params.id as string;
    const userId = req.body.userId as string;

    if (!userId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'userId is required',
      });
    }

    const conversation = await chatService.addMemberToGroup(conversationId, userId as string);

    res.status(StatusCodes.OK).json({
      success: true,
      data: conversation,
    });
  } catch (error: any) {
    logger.error('Error in addMember:', error);
    res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/v1/chat/groups/:id/members
 * Body: { userId }
 */
export const removeMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversationId = req.params.id as string;
    const userId = req.body.userId as string;

    if (!userId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'userId is required',
      });
    }

    const conversation = await chatService.removeMemberFromGroup(conversationId, userId as string);

    res.status(StatusCodes.OK).json({
      success: true,
      data: conversation,
    });
  } catch (error: any) {
    logger.error('Error in removeMember:', error);
    res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};
