import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Update user profile
const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
});

// Update user settings
const updateSettingsSchema = z.object({
  notifications: z.boolean().optional(),
  locationSharing: z.boolean().optional(),
  discoverable: z.boolean().optional(),
});

// Update user location
const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  precision: z.enum(['EXACT', 'APPROXIMATE', 'HIDDEN']).optional(),
});

// User query params
const userQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

// DTO Classes
export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
export class UpdateSettingsDto extends createZodDto(updateSettingsSchema) {}
export class UpdateLocationDto extends createZodDto(updateLocationSchema) {}
export class UserQueryDto extends createZodDto(userQuerySchema) {}
