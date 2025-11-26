import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { UsePipes, ValidationPipe } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from 'nestjs-zod';

// Example Zod Schema for validation
const SendMessageSchema = z.object({
  roomId: z.string().uuid(),
  content: z.string().min(1),
});

@WebSocketGateway({ cors: true })
export class ChatGateway {
  constructor(private readonly chatService: ChatService) {}

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    client.join(data.roomId);
    return { event: 'joined_room', data: { roomId: data.roomId } };
  }

  @SubscribeMessage('send_message')
  @UsePipes(new ZodValidationPipe(SendMessageSchema))
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; content: string },
  ) {
    // In a real app, senderId comes from client.data.user
    const message = this.chatService.saveMessage(data.roomId, 'temp-user-id', data.content);
    client.to(data.roomId).emit('message', message);
    return message;
  }
}
