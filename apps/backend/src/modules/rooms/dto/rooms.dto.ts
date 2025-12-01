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
  tags: z
    .string()
    .transform((val) => val.split(','))
    .optional(),
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

/**
 * Nearby rooms query (PostGIS-based)
 *
 * Note: Uses different param names (lat/lng) and units (meters) than roomDiscoverySchema
 * for PostGIS-optimized spatial queries. The shorter names and meter units align with
 * PostGIS conventions and reduce payload size for mobile clients.
 */
const nearbyRoomsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(100).max(50000).default(5000), // meters, default 5km
  tags: z
    .string()
    .transform((val) => val.split(',').map((t) => t.trim()).filter((t) => t))
    .pipe(z.array(z.string()).max(10))
    .optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(), // Composite cursor: "distance_id" format
});

// DTO Classes
export class CreateRoomDto extends createZodDto(createRoomSchema) {}
export class UpdateRoomDto extends createZodDto(updateRoomSchema) {}
export class RoomDiscoveryDto extends createZodDto(roomDiscoverySchema) {}
export class JoinRoomDto extends createZodDto(joinRoomSchema) {}
export class UpdateMemberRoleDto extends createZodDto(updateMemberRoleSchema) {}
export class NearbyRoomsDto extends createZodDto(nearbyRoomsSchema) {}

/**
 * Response type for nearby rooms with distance
 */
export interface NearbyRoomResponse {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  location: { type: 'Point'; coordinates: [number, number] };
  radiusMeters: number;
  isPublic: boolean;
  tags: string[];
  createdAt: Date;
  lastActivityAt: Date;
  memberCount: number;
  distanceMeters: number;
  creator: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
}
