import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { MessagesService } from './messages.service';
import { type SendMessageDto, type EditMessageDto, type GetMessagesDto, type MarkReadDto } from './dto/messages.dto';
import { CurrentUser } from '../../common/decorators';
import { type JwtPayload } from '../auth/dto/auth.dto';

/**
 * Messages Controller
 * Handles message CRUD endpoints
 */
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /**
   * Get messages from a room
   * GET /messages
   */
  @Get()
  async getMessages(@Query() query: GetMessagesDto) {
    return this.messagesService.getMessages(query);
  }

  /**
   * Send a message
   * POST /messages
   */
  @Post()
  async sendMessage(@CurrentUser() user: JwtPayload, @Body() dto: SendMessageDto) {
    return this.messagesService.sendMessage(user.sub, dto);
  }

  /**
   * Mark messages as read
   * POST /messages/read
   */
  @Post('read')
  async markAsRead(@CurrentUser() user: JwtPayload, @Body() dto: MarkReadDto) {
    return this.messagesService.markAsRead(user.sub, dto);
  }

  /**
   * Get unread count for a room
   * GET /messages/unread/:roomId
   * Note: Must be before :id route to avoid route conflicts
   */
  @Get('unread/:roomId')
  async getUnreadCount(@CurrentUser() user: JwtPayload, @Param('roomId') roomId: string) {
    const count = await this.messagesService.getUnreadCount(user.sub, roomId);
    return { unreadCount: count };
  }

  /**
   * Get a single message
   * GET /messages/:id
   */
  @Get(':id')
  async getMessage(@Param('id') id: string) {
    return this.messagesService.findById(id);
  }

  /**
   * Edit a message
   * PATCH /messages/:id
   */
  @Patch(':id')
  async editMessage(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: EditMessageDto
  ) {
    return this.messagesService.editMessage(id, user.sub, dto);
  }

  /**
   * Delete a message
   * DELETE /messages/:id
   */
  @Delete(':id')
  async deleteMessage(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.messagesService.deleteMessage(id, user.sub);
  }
}
