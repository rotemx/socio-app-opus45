import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Presence status values (shared across schemas)
export const PRESENCE_STATUSES = ['ONLINE', 'AWAY', 'BUSY', 'OFFLINE'] as const;

// Update presence status
const updatePresenceSchema = z.object({
  status: z.enum(PRESENCE_STATUSES),
});

// Get users presence
const getUsersPresenceSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(100),
});

// Presence response
export const presenceResponseSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(PRESENCE_STATUSES),
  lastSeenAt: z.coerce.date(),
});

// DTO Classes
export class UpdatePresenceDto extends createZodDto(updatePresenceSchema) {}
export class GetUsersPresenceDto extends createZodDto(getUsersPresenceSchema) {}

// Type exports
export type PresenceResponse = z.infer<typeof presenceResponseSchema>;
