-- Create StatusLocation enum
CREATE TYPE "StatusLocation" AS ENUM ('HOME', 'GREENSPACE', 'THIRD_PLACE');

-- Add location column to Status table
ALTER TABLE "Status" ADD COLUMN "location" "StatusLocation";

-- Delete all QUESTIONABLE statuses before removing from enum
DELETE FROM "Status" WHERE "status" = 'QUESTIONABLE';

-- Remove QUESTIONABLE from AvailabilityStatus enum
-- Note: PostgreSQL doesn't support removing enum values directly
-- We need to recreate the enum without QUESTIONABLE
-- First, create new enum
CREATE TYPE "AvailabilityStatus_new" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- Update Status table to use new enum
ALTER TABLE "Status" ALTER COLUMN "status" TYPE "AvailabilityStatus_new" USING "status"::text::"AvailabilityStatus_new";

-- Drop old enum
DROP TYPE "AvailabilityStatus";

-- Rename new enum to old name
ALTER TYPE "AvailabilityStatus_new" RENAME TO "AvailabilityStatus";
