import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { AuthModule } from '../auth';
import { PresenceModule } from '../presence/presence.module';
import { WsAuthGuard } from '../../common/guards/ws-auth.guard';

/**
 * Chat Module
 * Provides WebSocket gateway for real-time messaging
 *
 * Features:
 * - Authenticated WebSocket connections
 * - Room-based messaging
 * - Presence tracking integration
 * - Message persistence
 */
@Module({
  imports: [AuthModule, PresenceModule],
  providers: [ChatGateway, ChatService, WsAuthGuard],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
