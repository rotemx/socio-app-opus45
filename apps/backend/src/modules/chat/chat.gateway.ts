import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { type Socket } from 'socket.io';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { ChatService } from './chat.service';
import { Logger, UsePipes } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from 'nestjs-zod';

// Zod Schemas for validation
const JoinRoomSchema = z.object({
  roomId: z.string().uuid(),
});

const SendMessageSchema = z.object({
  roomId: z.string().uuid(),
  content: z.string().min(1),
});

@WebSocketGateway({ cors: true })
export class ChatGateway {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  @SubscribeMessage('join_room')
  @UsePipes(new ZodValidationPipe(JoinRoomSchema))
  async handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
    try {
      await client.join(data.roomId);
      return { event: 'joined_room', data: { roomId: data.roomId } };
    } catch (error) {
      this.logger.error('Failed to join room:', error);
      return { event: 'error', data: { message: 'Failed to join room' } };
    }
  }

  @SubscribeMessage('send_message')
  @UsePipes(new ZodValidationPipe(SendMessageSchema))
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; content: string }
  ) {
    // In a real app, senderId comes from client.data.user
    const message = this.chatService.saveMessage(data.roomId, 'temp-user-id', data.content);
    client.to(data.roomId).emit('message', message);
    return message;
  }
}
