import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Send message
const sendMessageSchema = z.object({
  roomId: z.string().uuid(),
  content: z.string().min(1).max(4000),
  contentType: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'LOCATION']).default('TEXT'),
  replyToId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Edit message
const editMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

// Get messages query
const getMessagesSchema = z
  .object({
    roomId: z.string().uuid(),
    limit: z.coerce.number().min(1).max(100).default(50),
    cursor: z.string().optional(),
    before: z.coerce.date().optional(),
    after: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.before && data.after) {
        return data.before > data.after;
      }
      return true;
    },
    { message: 'before must be later than after' }
  );

// Mark as read
const markReadSchema = z.object({
  roomId: z.string().uuid(),
  messageId: z.string().uuid(),
});

// DTO Classes
export class SendMessageDto extends createZodDto(sendMessageSchema) {}
export class EditMessageDto extends createZodDto(editMessageSchema) {}
export class GetMessagesDto extends createZodDto(getMessagesSchema) {}
export class MarkReadDto extends createZodDto(markReadSchema) {}
