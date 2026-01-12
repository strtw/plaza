-- Add firstName and lastName columns
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

-- Drop the name column
ALTER TABLE "User" DROP COLUMN IF EXISTS "name";
