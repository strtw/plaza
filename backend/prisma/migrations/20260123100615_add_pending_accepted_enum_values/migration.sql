-- Add PENDING and ACCEPTED to FriendStatus enum
-- PostgreSQL requires enum value additions to be committed before use
-- This migration only adds the enum values (separate from migration that uses them)

DO $$ BEGIN
  ALTER TYPE "FriendStatus" ADD VALUE IF NOT EXISTS 'PENDING';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "FriendStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
