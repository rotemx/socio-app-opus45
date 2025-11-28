import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from './prisma.service';

/**
 * Zod schema for GeoPoint validation
 */
export const GeoPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([
    z.number().min(-180).max(180), // longitude
    z.number().min(-90).max(90), // latitude
  ]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * Zod schema for room discovery options
 */
export const RoomDiscoveryOptionsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().positive().max(100000).optional(),
  limit: z.number().int().positive().max(1000).optional(),
  offset: z.number().int().nonnegative().optional(),
  tags: z.array(z.string().min(1).max(100)).max(50).optional(),
});

/**
 * UUID validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GeoJSON Point structure
 */
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
  latitude: number;
  longitude: number;
}

/**
 * Room with distance from a reference point
 */
export interface RoomWithDistance {
  roomId: string;
  distanceMeters: number;
}

/**
 * Options for room discovery queries
 */
export interface RoomDiscoveryOptions {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  limit?: number;
  offset?: number;
  tags?: string[];
}

/**
 * Spatial Query Service
 * Provides PostGIS-powered geospatial query capabilities
 */
@Injectable()
export class SpatialService {
  private readonly logger = new Logger(SpatialService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a GeoJSON Point from latitude and longitude
   */
  createPoint(latitude: number, longitude: number): GeoPoint {
    this.validateCoordinates(latitude, longitude, 'createPoint');
    return {
      type: 'Point',
      coordinates: [longitude, latitude],
      latitude,
      longitude,
    };
  }

  /**
   * Validate coordinate inputs
   */
  private validateCoordinates(lat: number, lng: number, context: string): void {
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new Error(`Invalid latitude in ${context}: ${lat}`);
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new Error(`Invalid longitude in ${context}: ${lng}`);
    }
  }

  /**
   * Validate radius input
   */
  private validateRadius(radius: number, context: string): void {
    if (!Number.isFinite(radius) || radius <= 0 || radius > 100000) {
      throw new Error(
        `Invalid radius in ${context}: ${radius}. Must be between 0 and 100000 meters.`
      );
    }
  }

  /**
   * Calculate distance between two points in meters
   * Uses PostGIS ST_DistanceSphere for accurate geodesic distance
   */
  async calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): Promise<number> {
    this.validateCoordinates(lat1, lng1, 'calculateDistance point 1');
    this.validateCoordinates(lat2, lng2, 'calculateDistance point 2');

    try {
      const result = await this.prisma.$queryRaw<[{ distance: number }]>`
        SELECT ST_DistanceSphere(
          ST_MakePoint(${lng1}, ${lat1}),
          ST_MakePoint(${lng2}, ${lat2})
        ) as distance
      `;

      if (!result[0]) {
        throw new Error('Distance query returned no results');
      }
      return result[0].distance;
    } catch (error) {
      this.logger.error(
        `Failed to calculate distance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new Error(
        `Distance calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if two points are within a specified radius
   */
  async isWithinRadius(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
    radiusMeters: number
  ): Promise<boolean> {
    this.validateCoordinates(lat1, lng1, 'isWithinRadius point 1');
    this.validateCoordinates(lat2, lng2, 'isWithinRadius point 2');
    this.validateRadius(radiusMeters, 'isWithinRadius');

    try {
      const result = await this.prisma.$queryRaw<[{ within: boolean }]>`
        SELECT ST_DWithin(
          ST_MakePoint(${lng1}, ${lat1})::geography,
          ST_MakePoint(${lng2}, ${lat2})::geography,
          ${radiusMeters}
        ) as within
      `;

      if (!result[0]) {
        throw new Error('Query returned no results');
      }
      return result[0].within;
    } catch (error) {
      this.logger.error(
        `Failed to check radius: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new Error(
        `Radius check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find rooms within a radius of a given point
   * Uses PostGIS for efficient spatial queries
   */
  async findRoomsWithinRadius(options: RoomDiscoveryOptions): Promise<RoomWithDistance[]> {
    // Validate input using Zod
    const validated = RoomDiscoveryOptionsSchema.parse(options);
    const { latitude, longitude, radiusMeters = 5000, limit = 50, offset = 0 } = validated;

    this.logger.debug(`Finding rooms within ${radiusMeters}m of (${latitude}, ${longitude})`);

    try {
      const rooms = await this.prisma.$queryRaw<RoomWithDistance[]>`
        SELECT
          cr.id::text as "roomId",
          ST_DistanceSphere(
            ST_MakePoint(${longitude}, ${latitude}),
            ST_MakePoint(
              (cr.location->>'longitude')::DOUBLE PRECISION,
              (cr.location->>'latitude')::DOUBLE PRECISION
            )
          ) as "distanceMeters"
        FROM chat_rooms cr
        WHERE
          cr.is_active = true
          AND cr.is_public = true
          AND cr.location IS NOT NULL
          AND cr.location->>'latitude' IS NOT NULL
          AND cr.location->>'longitude' IS NOT NULL
          AND ST_DWithin(
            ST_MakePoint(${longitude}, ${latitude})::geography,
            ST_MakePoint(
              (cr.location->>'longitude')::DOUBLE PRECISION,
              (cr.location->>'latitude')::DOUBLE PRECISION
            )::geography,
            ${radiusMeters}
          )
        ORDER BY "distanceMeters" ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      return rooms;
    } catch (error) {
      this.logger.error(
        `Failed to find rooms within radius: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new Error(
        `Room discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find rooms within radius with tag filtering
   */
  async findRoomsWithinRadiusWithTags(options: RoomDiscoveryOptions): Promise<RoomWithDistance[]> {
    // Validate input using Zod
    const validated = RoomDiscoveryOptionsSchema.parse(options);
    const {
      latitude,
      longitude,
      radiusMeters = 5000,
      limit = 50,
      offset = 0,
      tags = [],
    } = validated;

    if (tags.length === 0) {
      return this.findRoomsWithinRadius(options);
    }

    this.logger.debug(`Finding rooms within ${radiusMeters}m with tags: ${tags.join(', ')}`);

    try {
      const rooms = await this.prisma.$queryRaw<RoomWithDistance[]>`
        SELECT
          cr.id::text as "roomId",
          ST_DistanceSphere(
            ST_MakePoint(${longitude}, ${latitude}),
            ST_MakePoint(
              (cr.location->>'longitude')::DOUBLE PRECISION,
              (cr.location->>'latitude')::DOUBLE PRECISION
            )
          ) as "distanceMeters"
        FROM chat_rooms cr
        WHERE
          cr.is_active = true
          AND cr.is_public = true
          AND cr.location IS NOT NULL
          AND cr.location->>'latitude' IS NOT NULL
          AND cr.location->>'longitude' IS NOT NULL
          AND cr.tags && ${tags}::text[]
          AND ST_DWithin(
            ST_MakePoint(${longitude}, ${latitude})::geography,
            ST_MakePoint(
              (cr.location->>'longitude')::DOUBLE PRECISION,
              (cr.location->>'latitude')::DOUBLE PRECISION
            )::geography,
            ${radiusMeters}
          )
        ORDER BY "distanceMeters" ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      return rooms;
    } catch (error) {
      this.logger.error(
        `Failed to find rooms with tags: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new Error(
        `Room discovery with tags failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Count rooms within a radius
   */
  async countRoomsWithinRadius(
    latitude: number,
    longitude: number,
    radiusMeters: number = 5000
  ): Promise<number> {
    this.validateCoordinates(latitude, longitude, 'countRoomsWithinRadius');
    this.validateRadius(radiusMeters, 'countRoomsWithinRadius');

    try {
      const result = await this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count
        FROM chat_rooms cr
        WHERE
          cr.is_active = true
          AND cr.is_public = true
          AND cr.location IS NOT NULL
          AND cr.location->>'latitude' IS NOT NULL
          AND cr.location->>'longitude' IS NOT NULL
          AND ST_DWithin(
            ST_MakePoint(${longitude}, ${latitude})::geography,
            ST_MakePoint(
              (cr.location->>'longitude')::DOUBLE PRECISION,
              (cr.location->>'latitude')::DOUBLE PRECISION
            )::geography,
            ${radiusMeters}
          )
      `;

      return Number(result[0]?.count ?? 0);
    } catch (error) {
      this.logger.error(
        `Failed to count rooms: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new Error(
        `Room count failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find nearby users (for potential features like "who's nearby")
   * Only returns users who have opted into location sharing
   */
  async findNearbyUsers(
    latitude: number,
    longitude: number,
    radiusMeters: number = 1000,
    limit: number = 20
  ): Promise<{ userId: string; distanceMeters: number }[]> {
    this.validateCoordinates(latitude, longitude, 'findNearbyUsers');
    this.validateRadius(radiusMeters, 'findNearbyUsers');

    if (!Number.isFinite(limit) || limit <= 0 || limit > 1000) {
      throw new Error(`Invalid limit: ${limit}. Must be between 1 and 1000.`);
    }

    try {
      const users = await this.prisma.$queryRaw<{ userId: string; distanceMeters: number }[]>`
        SELECT
          u.id::text as "userId",
          ST_DistanceSphere(
            ST_MakePoint(${longitude}, ${latitude}),
            ST_MakePoint(
              (u.current_location->>'longitude')::DOUBLE PRECISION,
              (u.current_location->>'latitude')::DOUBLE PRECISION
            )
          ) as "distanceMeters"
        FROM users u
        WHERE
          u.is_active = true
          AND u.current_location IS NOT NULL
          AND u.current_location->>'latitude' IS NOT NULL
          AND u.current_location->>'longitude' IS NOT NULL
          AND u.location_precision != 'HIDDEN'
          AND (u.settings->>'discoverable')::boolean = true
          AND ST_DWithin(
            ST_MakePoint(${longitude}, ${latitude})::geography,
            ST_MakePoint(
              (u.current_location->>'longitude')::DOUBLE PRECISION,
              (u.current_location->>'latitude')::DOUBLE PRECISION
            )::geography,
            ${radiusMeters}
          )
        ORDER BY "distanceMeters" ASC
        LIMIT ${limit}
      `;

      return users;
    } catch (error) {
      this.logger.error(
        `Failed to find nearby users: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new Error(
        `Find nearby users failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update a room's computed location based on member positions
   * Uses weighted centroid calculation
   */
  async updateRoomComputedLocation(roomId: string): Promise<void> {
    // Validate UUID format
    if (!UUID_REGEX.test(roomId)) {
      throw new Error(`Invalid room ID format: ${roomId}`);
    }

    this.logger.debug(`Updating computed location for room ${roomId}`);

    try {
      await this.prisma.$executeRaw`
        SELECT update_room_computed_location(${roomId}::uuid)
      `;
    } catch (error) {
      this.logger.error(
        `Failed to update room location for ${roomId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new Error(
        `Failed to update room computed location: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get the bounding box for a set of coordinates
   * Useful for map viewport calculations
   */
  async getBoundingBox(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ): Promise<{
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }> {
    this.validateCoordinates(latitude, longitude, 'getBoundingBox');
    this.validateRadius(radiusMeters, 'getBoundingBox');

    try {
      const result = await this.prisma.$queryRaw<
        [{ min_lat: number; max_lat: number; min_lng: number; max_lng: number }]
      >`
        SELECT
          ST_YMin(ST_Buffer(ST_MakePoint(${longitude}, ${latitude})::geography, ${radiusMeters})::geometry) as min_lat,
          ST_YMax(ST_Buffer(ST_MakePoint(${longitude}, ${latitude})::geography, ${radiusMeters})::geometry) as max_lat,
          ST_XMin(ST_Buffer(ST_MakePoint(${longitude}, ${latitude})::geography, ${radiusMeters})::geometry) as min_lng,
          ST_XMax(ST_Buffer(ST_MakePoint(${longitude}, ${latitude})::geography, ${radiusMeters})::geometry) as max_lng
      `;

      if (!result[0]) {
        throw new Error('Bounding box calculation returned no results');
      }

      return {
        minLat: result[0].min_lat,
        maxLat: result[0].max_lat,
        minLng: result[0].min_lng,
        maxLng: result[0].max_lng,
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate bounding box: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new Error(
        `Bounding box calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate that PostGIS is properly installed and configured
   */
  async validatePostGISInstallation(): Promise<{
    installed: boolean;
    version: string | null;
  }> {
    try {
      const result = await this.prisma.$queryRaw<[{ version: string }]>`
        SELECT PostGIS_Version() as version
      `;

      return {
        installed: true,
        version: result[0]?.version ?? null,
      };
    } catch (error) {
      this.logger.error('PostGIS validation failed', error);
      return {
        installed: false,
        version: null,
      };
    }
  }
}
