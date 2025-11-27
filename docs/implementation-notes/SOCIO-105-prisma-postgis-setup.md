# SOCIO-105: Setup Prisma with PostgreSQL/PostGIS

## Overview

This ticket implemented PostgreSQL/PostGIS database infrastructure for geospatial queries, including Docker services, database initialization, spatial query utilities, and seeding.

## Implementation Summary

### Files Created

1. **`apps/backend/scripts/init-db.sql`**
   - PostGIS extension initialization (postgis, uuid-ossp, pg_trgm)
   - Helper functions:
     - `calculate_distance_meters()` - Distance between two points in meters
     - `is_within_radius()` - Check if two points are within specified radius
     - `has_valid_location_json()` - Validate JSONB location structure and bounds
     - `find_rooms_within_radius()` - Find rooms near a point with distance
     - `update_room_computed_location()` - Update room centroid from member locations
   - Spatial indexes (GIST) for efficient geospatial queries
   - Automatically runs on Docker container start

2. **`apps/backend/src/database/spatial.service.ts`**
   - NestJS injectable service for PostGIS operations
   - Zod schemas for runtime validation (GeoPointSchema, RoomDiscoveryOptionsSchema)
   - Methods:
     - `createPoint()` - Create GeoJSON Point
     - `calculateDistance()` - Distance between two points
     - `isWithinRadius()` - Check proximity
     - `findRoomsWithinRadius()` - Room discovery with pagination
     - `findRoomsWithinRadiusWithTags()` - Room discovery with tag filtering
     - `countRoomsWithinRadius()` - Count nearby rooms
     - `findNearbyUsers()` - Find discoverable users nearby
     - `updateRoomComputedLocation()` - Update room centroid
     - `getBoundingBox()` - Get viewport bounds for map
     - `validatePostGISInstallation()` - Verify PostGIS is working
   - Full error handling and input validation

3. **`apps/backend/prisma/seed.ts`**
   - Database seeding script for development
   - Creates 3 test users around Tel Aviv area
   - Creates 3 test chat rooms with different configurations
   - Sets up room memberships and test messages
   - Creates presence records

### Files Modified

1. **`apps/backend/src/database/database.module.ts`**
   - Added SpatialService to providers and exports

2. **`apps/backend/src/database/index.ts`**
   - Added exports for SpatialService and Zod schemas

3. **`apps/backend/scripts/docker-services.sh`**
   - Added automatic init-db.sql execution after PostgreSQL starts
   - Added proper error handling for database initialization

4. **`apps/backend/package.json`**
   - Added database scripts: `db:seed`, `db:reset`, `db:studio`, `db:init`, `db:migrate:prod`
   - Added prisma seed configuration
   - Added ts-node devDependency

## Database Schema Notes

### Location JSON Structure

All location fields use a consistent GeoJSON-like structure:

```json
{
  "type": "Point",
  "coordinates": [longitude, latitude],
  "latitude": 32.0853,
  "longitude": 34.7818
}
```

### Spatial Indexes

Two GIST indexes are created for efficient spatial queries:
- `idx_chat_rooms_location_point` - On chat_rooms.location
- `idx_users_location_point` - On users.current_location (partial, only non-null)

## Usage

### Starting Services

```bash
# Start PostgreSQL and Redis
pnpm docker:start

# Check status
pnpm docker:status

# Stop services
pnpm docker:stop
```

### Database Operations

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed database
pnpm db:seed

# Reset database (destructive)
pnpm db:reset

# Open Prisma Studio
pnpm db:studio
```

### Using SpatialService

```typescript
import { SpatialService } from '../database';

// In a NestJS service/controller
constructor(private readonly spatial: SpatialService) {}

// Find rooms within 5km of Tel Aviv
const rooms = await this.spatial.findRoomsWithinRadius({
  latitude: 32.0853,
  longitude: 34.7818,
  radiusMeters: 5000,
  limit: 50,
});

// Calculate distance between two points
const distance = await this.spatial.calculateDistance(
  32.0853, 34.7818,  // Tel Aviv
  32.0800, 34.7750   // Nearby point
);

// Check if user is within room radius
const inRange = await this.spatial.isWithinRadius(
  userLat, userLng,
  roomLat, roomLng,
  roomRadiusMeters
);
```

## Code Review Fixes Applied

After 4 iterations of coderabbit review, the following issues were addressed:

1. **Error handling** - All methods now have try-catch blocks with proper logging
2. **Input validation** - Zod schemas and coordinate validation added
3. **SQL safety** - JSON key existence checks and numeric validation
4. **Geographic bounds** - Latitude/longitude range validation (-90/90, -180/180)
5. **Function volatility** - Changed STABLE to VOLATILE for mutable queries
6. **Refactoring** - Extracted `has_valid_location_json()` helper function
7. **Docker script** - Proper error handling for init script execution

## Environment Variables

Required in `.env`:

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/socio_dev
REDIS_URL=redis://localhost:6379
```

## Test Data

The seed script creates:

- **Users**: testuser1, testuser2, testuser3 (password: password123)
- **Rooms**:
  - Tel Aviv Pride (public, 5km radius)
  - Rothschild Hangout (public, 1km radius)
  - Private Group (private, 500m radius)

## Dependencies

- PostgreSQL 16 with PostGIS 3.4+
- Redis 7
- Prisma 5.22+
- Zod 3.22+
