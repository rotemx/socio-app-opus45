import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Create room
const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().min(100).max(50000).default(5000),
  isPublic: z.boolean().default(true),
  maxMembers: z.number().min(2).max(1000).default(100),
  tags: z.array(z.string()).max(10).default([]),
});

// Update room
const updateRoomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
  isPublic: z.boolean().optional(),
  maxMembers: z.number().min(2).max(1000).optional(),
  tags: z.array(z.string()).max(10).optional(),
  settings: z
    .object({
      allowMedia: z.boolean().optional(),
      requireLocationCheck: z.boolean().optional(),
      voiceEnabled: z.boolean().optional(),
      videoEnabled: z.boolean().optional(),
    })
    .optional(),
});

// Room discovery query
const roomDiscoverySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.1).max(50).default(5),
  tags: z.string().transform((val) => val.split(',')).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

// Join room
const joinRoomSchema = z.object({
  roomId: z.string().uuid(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

// Update member role
const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MODERATOR', 'MEMBER']),
});

// DTO Classes
export class CreateRoomDto extends createZodDto(createRoomSchema) {}
export class UpdateRoomDto extends createZodDto(updateRoomSchema) {}
export class RoomDiscoveryDto extends createZodDto(roomDiscoverySchema) {}
export class JoinRoomDto extends createZodDto(joinRoomSchema) {}
export class UpdateMemberRoleDto extends createZodDto(updateMemberRoleSchema) {}
