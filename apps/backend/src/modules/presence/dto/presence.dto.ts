import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Presence status values (shared across schemas)
// IDLE: User has been inactive for 5+ minutes
export const PRESENCE_STATUSES = ['ONLINE', 'IDLE', 'AWAY', 'BUSY', 'OFFLINE'] as const;

// Type for presence status
export type PresenceStatusType = (typeof PRESENCE_STATUSES)[number];

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

// Room presence entry schema
export const roomPresenceEntrySchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(PRESENCE_STATUSES),
  lastSeenAt: z.number().int().nonnegative(),
});

// Room presence response schema
// Counts for all presence statuses for complete tracking
export const roomPresenceResponseSchema = z.object({
  roomId: z.string().uuid(),
  members: z.array(roomPresenceEntrySchema),
  totalOnline: z.number().int().nonnegative(),
  totalIdle: z.number().int().nonnegative(),
  totalAway: z.number().int().nonnegative(),
  totalBusy: z.number().int().nonnegative(),
  totalOffline: z.number().int().nonnegative(),
});

// User-settable statuses for room presence (excludes OFFLINE - users cannot manually set offline in room)
export const ROOM_PRESENCE_STATUSES = ['ONLINE', 'IDLE', 'AWAY', 'BUSY'] as const;

// Update presence in room schema
const updateRoomPresenceSchema = z.object({
  roomId: z.string().uuid(),
  status: z.enum(ROOM_PRESENCE_STATUSES),
});

// DTO Classes
export class UpdatePresenceDto extends createZodDto(updatePresenceSchema) {}
export class GetUsersPresenceDto extends createZodDto(getUsersPresenceSchema) {}
export class UpdateRoomPresenceDto extends createZodDto(updateRoomPresenceSchema) {}

// Type exports
export type PresenceResponse = z.infer<typeof presenceResponseSchema>;
export type RoomPresenceEntryType = z.infer<typeof roomPresenceEntrySchema>;
export type RoomPresenceResponse = z.infer<typeof roomPresenceResponseSchema>;
