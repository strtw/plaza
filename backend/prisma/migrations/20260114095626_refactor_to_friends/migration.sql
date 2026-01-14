-- Create FriendStatus enum
CREATE TYPE "FriendStatus" AS ENUM ('ACTIVE', 'MUTED', 'BLOCKED');

-- Rename AppContact table to Friend
ALTER TABLE "AppContact" RENAME TO "Friend";

-- Drop old unique constraint (must be done before dropping phoneHash column)
ALTER TABLE "Friend" DROP CONSTRAINT IF EXISTS "AppContact_userId_phoneHash_key";

-- Drop phoneHash column
ALTER TABLE "Friend" DROP COLUMN IF EXISTS "phoneHash";

-- Rename plazaUserId to friendUserId
ALTER TABLE "Friend" RENAME COLUMN "plazaUserId" TO "friendUserId";

-- Add status column with default
ALTER TABLE "Friend" ADD COLUMN "status" "FriendStatus" NOT NULL DEFAULT 'ACTIVE';

-- Add new unique constraint
ALTER TABLE "Friend" ADD CONSTRAINT "Friend_userId_friendUserId_key" UNIQUE ("userId", "friendUserId");

-- Drop old indexes
DROP INDEX IF EXISTS "AppContact_userId_idx";
DROP INDEX IF EXISTS "AppContact_phoneHash_idx";
DROP INDEX IF EXISTS "AppContact_plazaUserId_idx";

-- Create new indexes
CREATE INDEX "Friend_userId_idx" ON "Friend"("userId");
CREATE INDEX "Friend_friendUserId_idx" ON "Friend"("friendUserId");

-- Update foreign key constraint names
ALTER TABLE "Friend" DROP CONSTRAINT IF EXISTS "AppContact_userId_fkey";
ALTER TABLE "Friend" DROP CONSTRAINT IF EXISTS "AppContact_plazaUserId_fkey";

ALTER TABLE "Friend" ADD CONSTRAINT "Friend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Friend" ADD CONSTRAINT "Friend_friendUserId_fkey" FOREIGN KEY ("friendUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Delete orphan AppContacts (now Friend records) where friendUserId IS NULL
DELETE FROM "Friend" WHERE "friendUserId" IS NULL;

-- Migrate Contact data to Friend (one direction only: userId -> contactUserId)
-- Only migrate ACTIVE contacts
INSERT INTO "Friend" ("id", "userId", "friendUserId", "status", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid()::text,
  "userId",
  "contactUserId",
  'ACTIVE',
  "createdAt",
  "updatedAt"
FROM "Contact"
WHERE "status" = 'ACTIVE'
ON CONFLICT ("userId", "friendUserId") DO NOTHING;

-- Drop Contact table (foreign keys will cascade)
DROP TABLE "Contact";

-- Drop ContactStatus enum
DROP TYPE "ContactStatus";
