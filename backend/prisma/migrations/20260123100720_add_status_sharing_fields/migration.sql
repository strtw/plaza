-- Step 1: Migrate existing data: ACTIVE -> ACCEPTED
-- (Enum values PENDING and ACCEPTED were added in previous migration)
UPDATE "Friend" SET "status" = 'ACCEPTED' WHERE "status" = 'ACTIVE';

-- Step 2: Update default value to ACCEPTED
ALTER TABLE "Friend" ALTER COLUMN "status" SET DEFAULT 'ACCEPTED';

-- Step 3: Add acceptedFromStatusId column to Friend (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Friend' AND column_name = 'acceptedFromStatusId'
  ) THEN
    ALTER TABLE "Friend" ADD COLUMN "acceptedFromStatusId" TEXT;
  END IF;
END $$;

-- Step 4: Add sharedWith column to Status (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Status' AND column_name = 'sharedWith'
  ) THEN
    ALTER TABLE "Status" ADD COLUMN "sharedWith" TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;
END $$;

-- Step 5: Create GIN index on sharedWith for efficient array queries (if not exists)
CREATE INDEX IF NOT EXISTS "Status_sharedWith_idx" ON "Status" USING GIN ("sharedWith");

-- Step 6: Add foreign key constraint for acceptedFromStatusId (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'Friend_acceptedFromStatusId_fkey'
  ) THEN
    ALTER TABLE "Friend" ADD CONSTRAINT "Friend_acceptedFromStatusId_fkey" 
      FOREIGN KEY ("acceptedFromStatusId") REFERENCES "Status"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
