-- Delete any statuses with NULL message or location (invalid records)
DELETE FROM "Status" WHERE "message" IS NULL OR "location" IS NULL;

-- Make message column NOT NULL
ALTER TABLE "Status" ALTER COLUMN "message" SET NOT NULL;

-- Make location column NOT NULL
ALTER TABLE "Status" ALTER COLUMN "location" SET NOT NULL;
