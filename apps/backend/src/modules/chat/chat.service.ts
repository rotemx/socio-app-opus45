import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatService {
  saveMessage(roomId: string, senderId: string, content: string) {
    // Mock implementation - in reality this would use Prisma
    return {
      id: 'msg_' + Date.now(),
      roomId,
      senderId,
      content,
      createdAt: new Date(),
    };
  }
}
