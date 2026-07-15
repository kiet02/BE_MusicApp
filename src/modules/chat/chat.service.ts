import { Types } from 'mongoose';
import { Conversation, Message } from './chat.model';
import { logger } from '../../shared/utils/logger';

export class ChatService {
  /**
   * Tìm hoặc tạo phòng chat giữa 2 user.
   * Sắp xếp participants để đảm bảo [A,B] và [B,A] luôn lưu cùng thứ tự.
   * Dùng findOneAndUpdate + upsert để tránh race condition tạo phòng trùng.
   */
  async getOrCreateConversation(userAId: string, userBId: string) {
    if (userAId === userBId) {
      throw new Error('Cannot create a conversation with yourself');
    }

    // Luôn sắp xếp theo thứ tự để đảm bảo nhất quán
    const sortedIds = [userAId, userBId].sort();
    const participantIds = [new Types.ObjectId(sortedIds[0]), new Types.ObjectId(sortedIds[1])];

    // Atomic: tìm hoặc tạo trong 1 operation duy nhất
    const conversation = await Conversation.findOneAndUpdate(
      { participants: participantIds },
      { $setOnInsert: { participants: participantIds } },
      { upsert: true, new: true },
    );

    // Populate để trả về đầy đủ thông tin
    const populated = await Conversation.findById(conversation._id)
      .populate('participants', 'name email')
      .populate('lastMessage');

    return populated;
  }

  /**
   * Lấy danh sách phòng chat của 1 user, sắp xếp theo tin nhắn mới nhất.
   */
  async getConversations(userId: string) {
    return Conversation.find({
      participants: new Types.ObjectId(userId),
    })
      .populate('participants', 'name email')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });
  }

  /**
   * Lấy lịch sử tin nhắn của 1 conversation (phân trang, mới nhất trước).
   */
  async getMessages(conversationId: string, page: number = 1, limit: number = 30) {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({ conversationId: new Types.ObjectId(conversationId) })
        .populate('senderId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Message.countDocuments({ conversationId: new Types.ObjectId(conversationId) }),
    ]);

    return {
      messages: messages.reverse(), // Đảo lại để tin cũ ở trên, mới ở dưới
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Tạo tin nhắn mới và cập nhật lastMessage của conversation.
   */
  async createMessage(conversationId: string, senderId: string, content: string) {
    const message = await Message.create({
      conversationId: new Types.ObjectId(conversationId),
      senderId: new Types.ObjectId(senderId),
      content,
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      updatedAt: new Date(),
    });

    const populated = await Message.findById(message._id).populate('senderId', 'name email');

    return populated;
  }

  // ─── GROUP CHAT ────────────────────────────────────────────

  /**
   * Tạo phòng chat nhóm.
   */
  async createGroupConversation(groupName: string, memberIds: string[]) {
    if (memberIds.length < 2) {
      throw new Error('A group must have at least 2 members');
    }

    const uniqueIds = [...new Set(memberIds)];
    const participantIds = uniqueIds.map((id) => new Types.ObjectId(id));

    const conversation = await Conversation.create({
      participants: participantIds,
      isGroup: true,
      groupName,
    });

    const populated = await Conversation.findById(conversation._id)
      .populate('participants', 'name email')
      .populate('lastMessage');

    logger.info(`Group "${groupName}" created with ${uniqueIds.length} members`);
    return populated;
  }

  /**
   * Thêm thành viên vào nhóm.
   */
  async addMemberToGroup(conversationId: string, userId: string) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error('Conversation not found');
    if (!conversation.isGroup) throw new Error('Cannot add members to a 1-1 conversation');

    const userObjId = new Types.ObjectId(userId);
    const alreadyIn = conversation.participants.some((p) => p.equals(userObjId));
    if (alreadyIn) throw new Error('User is already a member');

    conversation.participants.push(userObjId);
    await conversation.save();

    return Conversation.findById(conversationId)
      .populate('participants', 'name email')
      .populate('lastMessage');
  }

  /**
   * Xóa thành viên khỏi nhóm.
   */
  async removeMemberFromGroup(conversationId: string, userId: string) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error('Conversation not found');
    if (!conversation.isGroup) throw new Error('Cannot remove members from a 1-1 conversation');

    const userObjId = new Types.ObjectId(userId);
    conversation.participants = conversation.participants.filter(
      (p) => !p.equals(userObjId),
    ) as Types.Array<Types.ObjectId>;

    if (conversation.participants.length < 2) {
      throw new Error('A group must have at least 2 members');
    }

    await conversation.save();

    return Conversation.findById(conversationId)
      .populate('participants', 'name email')
      .populate('lastMessage');
  }
}

export const chatService = new ChatService();
