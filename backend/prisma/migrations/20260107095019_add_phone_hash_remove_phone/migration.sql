-- Step 1: Add phoneHash column (nullable initially - will be made non-nullable after data migration)
ALTER TABLE "User" ADD COLUMN "phoneHash" TEXT;

-- Step 2: Create index on phoneHash (allows NULL values)
CREATE INDEX "User_phoneHash_idx" ON "User"("phoneHash");

-- Step 3: Drop phone column (this will remove phone column and its unique constraint)
-- Note: If you have existing data, you should run the data migration script first
-- to populate phoneHash before dropping the phone column
ALTER TABLE "User" DROP COLUMN IF EXISTS "phone";

-- Step 4: Make phoneHash unique (allows NULL for now)
-- We'll make it non-nullable in a separate step after data migration
CREATE UNIQUE INDEX IF NOT EXISTS "User_phoneHash_key" ON "User"("phoneHash") WHERE "phoneHash" IS NOT NULL;

-- Note: After running the data migration script (scripts/migrate-phone-to-hash.ts),
-- you should run this additional SQL to make phoneHash non-nullable:
-- ALTER TABLE "User" ALTER COLUMN "phoneHash" SET NOT NULL;

