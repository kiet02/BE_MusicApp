import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from '../../shared/utils/logger';
import { chatService } from './chat.service';

let io: Server;

export function initChatGateway(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    const clientId = socket.id;

    logger.info(`[WS][${clientId}] 🟢 Connected | online: ${io.engine.clientsCount}`);

    // ─── Join: Client gửi userId để xác định danh tính ───
    socket.on('chat:join', (userId: string) => {
      socket.data.userId = userId;
      logger.info(`[WS][${clientId}] 👤 User ${userId} identified`);
      socket.emit('chat:joined', { message: 'Connected successfully' });
    });

    // ─── Join Room: Client tham gia 1 phòng chat cụ thể ───
    socket.on('chat:join-room', (conversationId: string) => {
      socket.join(conversationId);
      socket.data.currentRoom = conversationId;
      logger.info(`[WS][${clientId}] 🏠 Joined room: ${conversationId}`);

      socket.emit('chat:room-joined', {
        conversationId,
        message: `Joined room ${conversationId}`,
      });
    });

    // ─── Leave Room: Client rời phòng chat ───
    socket.on('chat:leave-room', (conversationId: string) => {
      socket.leave(conversationId);
      logger.info(`[WS][${clientId}] 🚪 Left room: ${conversationId}`);
    });

    // ─── Message: Gửi tin nhắn vào phòng + lưu DB ───
    socket.on('chat:message', async (data: { conversationId: string; content: string }) => {
      const userId = socket.data.userId;
      if (!userId) {
        socket.emit('chat:error', { message: 'You must identify first (chat:join)' });
        return;
      }

      try {
        // Lưu tin nhắn vào MongoDB
        const message = await chatService.createMessage(data.conversationId, userId, data.content);

        logger.info(`[WS][${clientId}] 💬 Room ${data.conversationId}: "${data.content}"`);

        // Broadcast tin nhắn CHỈ trong room này
        io.to(data.conversationId).emit('chat:message', message);
      } catch (err: any) {
        logger.error(`[WS][${clientId}] Error sending message:`, err);
        socket.emit('chat:error', { message: 'Failed to send message' });
      }
    });

    // ─── Typing: Chỉ gửi cho room ───
    socket.on('chat:typing', (data: { conversationId: string; isTyping: boolean }) => {
      const userId = socket.data.userId;
      socket.to(data.conversationId).emit('chat:typing', {
        userId,
        isTyping: data.isTyping,
      });
    });

    // ─── Disconnect ───
    socket.on('disconnect', (reason: string) => {
      const userId = socket.data.userId || 'unknown';
      logger.info(
        `[WS][${clientId}] 🔴 User ${userId} disconnected | reason: ${reason} | online: ${io.engine.clientsCount}`,
      );
    });
  });

  logger.info('💬 WebSocket (Socket.IO) ready');
  return io;
}

export { io };
