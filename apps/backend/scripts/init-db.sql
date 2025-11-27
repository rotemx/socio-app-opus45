-- Database Initialization Script for Socio
-- This script is run after PostgreSQL starts to enable extensions
-- Run with: psql -U postgres -d socio_dev -f init-db.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Verify extensions are enabled
DO $$
BEGIN
    BEGIN
        RAISE NOTICE 'PostGIS version: %', PostGIS_Version();
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'PostGIS version: unable to determine';
    END;
    RAISE NOTICE 'UUID-OSSP extension: enabled';
    RAISE NOTICE 'pg_trgm extension: enabled';
END $$;

-- Create helper function for distance calculations (in meters)
CREATE OR REPLACE FUNCTION calculate_distance_meters(
    lat1 DOUBLE PRECISION,
    lng1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lng2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
BEGIN
    RETURN ST_DistanceSphere(
        ST_MakePoint(lng1, lat1),
        ST_MakePoint(lng2, lat2)
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create helper function to check if point is within radius
CREATE OR REPLACE FUNCTION is_within_radius(
    lat1 DOUBLE PRECISION,
    lng1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lng2 DOUBLE PRECISION,
    radius_meters DOUBLE PRECISION
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN ST_DWithin(
        ST_MakePoint(lng1, lat1)::geography,
        ST_MakePoint(lng2, lat2)::geography,
        radius_meters
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create helper function to validate location JSONB structure
-- Validates format and geographic bounds (lat: -90 to 90, lng: -180 to 180)
CREATE OR REPLACE FUNCTION has_valid_location_json(location JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    lat DOUBLE PRECISION;
    lng DOUBLE PRECISION;
BEGIN
    -- Check structure and format
    IF location IS NULL
        OR NOT (location ? 'latitude')
        OR NOT (location ? 'longitude')
        OR NOT (location->>'latitude' ~ '^-?[0-9]+(\.[0-9]+)?$')
        OR NOT (location->>'longitude' ~ '^-?[0-9]+(\.[0-9]+)?$')
    THEN
        RETURN FALSE;
    END IF;

    -- Check geographic bounds
    lat := (location->>'latitude')::DOUBLE PRECISION;
    lng := (location->>'longitude')::DOUBLE PRECISION;

    RETURN lat >= -90 AND lat <= 90 AND lng >= -180 AND lng <= 180;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to find rooms within radius of a point
-- This will be used for room discovery
CREATE OR REPLACE FUNCTION find_rooms_within_radius(
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    search_radius_meters DOUBLE PRECISION DEFAULT 5000
) RETURNS TABLE (
    room_id UUID,
    distance_meters DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cr.id::UUID as room_id,
        ST_DistanceSphere(
            ST_MakePoint(user_lng, user_lat),
            ST_MakePoint(
                (cr.location->>'longitude')::DOUBLE PRECISION,
                (cr.location->>'latitude')::DOUBLE PRECISION
            )
        ) as distance_meters
    FROM chat_rooms cr
    WHERE
        cr.is_active = true
        AND cr.is_public = true
        AND has_valid_location_json(cr.location)
        AND ST_DWithin(
            ST_MakePoint(user_lng, user_lat)::geography,
            ST_MakePoint(
                (cr.location->>'longitude')::DOUBLE PRECISION,
                (cr.location->>'latitude')::DOUBLE PRECISION
            )::geography,
            search_radius_meters
        )
    ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Create function to update room's computed location based on member locations
-- Uses weighted centroid calculation
CREATE OR REPLACE FUNCTION update_room_computed_location(target_room_id UUID)
RETURNS VOID AS $$
DECLARE
    weighted_lat DOUBLE PRECISION;
    weighted_lng DOUBLE PRECISION;
    total_weight DOUBLE PRECISION;
BEGIN
    SELECT
        SUM((rm.join_location->>'latitude')::DOUBLE PRECISION * rm.activity_weight) / NULLIF(SUM(rm.activity_weight), 0),
        SUM((rm.join_location->>'longitude')::DOUBLE PRECISION * rm.activity_weight) / NULLIF(SUM(rm.activity_weight), 0),
        SUM(rm.activity_weight)
    INTO weighted_lat, weighted_lng, total_weight
    FROM room_members rm
    WHERE rm.room_id = target_room_id
        AND has_valid_location_json(rm.join_location);

    IF total_weight > 0 THEN
        UPDATE chat_rooms
        SET computed_location = jsonb_build_object(
            'type', 'Point',
            'coordinates', jsonb_build_array(weighted_lng, weighted_lat),
            'latitude', weighted_lat,
            'longitude', weighted_lng,
            'lastUpdated', NOW()
        )
        WHERE id = target_room_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create index for spatial queries on location JSON field
-- Note: Using geometry type for GIST index as it's more efficient for functional indexes
CREATE INDEX IF NOT EXISTS idx_chat_rooms_location_point ON chat_rooms
USING GIST (
    ST_SetSRID(
        ST_MakePoint(
            (location->>'longitude')::DOUBLE PRECISION,
            (location->>'latitude')::DOUBLE PRECISION
        ),
        4326
    )
) WHERE location IS NOT NULL;

-- Create index for user location queries
CREATE INDEX IF NOT EXISTS idx_users_location_point ON users
USING GIST (
    ST_SetSRID(
        ST_MakePoint(
            (current_location->>'longitude')::DOUBLE PRECISION,
            (current_location->>'latitude')::DOUBLE PRECISION
        ),
        4326
    )
) WHERE current_location IS NOT NULL;

-- Create partial index for active public rooms (common query pattern)
CREATE INDEX IF NOT EXISTS idx_chat_rooms_active_public ON chat_rooms (is_active, is_public)
WHERE is_active = true AND is_public = true;

-- Grant usage on functions to application user (if using separate user)
-- GRANT EXECUTE ON FUNCTION calculate_distance_meters TO socio_app;
-- GRANT EXECUTE ON FUNCTION is_within_radius TO socio_app;
-- GRANT EXECUTE ON FUNCTION find_rooms_within_radius TO socio_app;
-- GRANT EXECUTE ON FUNCTION update_room_computed_location TO socio_app;

-- Output success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'Database initialization completed!';
    RAISE NOTICE 'Extensions enabled: postgis, uuid-ossp, pg_trgm';
    RAISE NOTICE 'Helper functions created: calculate_distance_meters, is_within_radius, find_rooms_within_radius';
    RAISE NOTICE 'Spatial indexes created for rooms and users';
    RAISE NOTICE '==========================================';
END $$;
