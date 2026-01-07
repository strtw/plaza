/**
 * Data Migration Script: Hash Existing Phone Numbers
 * 
 * This script should be run AFTER the schema migration but BEFORE making phoneHash non-nullable
 * 
 * Usage:
 *   ts-node scripts/migrate-phone-to-hash.ts
 * 
 * Or with environment variables:
 *   PHONE_HASH_SECRET=your_secret DATABASE_URL=your_db_url ts-node scripts/migrate-phone-to-hash.ts
 */

import { PrismaClient } from '@prisma/client';
import { hashPhone } from '../src/common/utils/phone-hash.util';
import * as readline from 'readline';

const prisma = new PrismaClient();

async function migratePhonesToHashes() {
  console.log('Starting phone number to hash migration...');
  
  // Check if PHONE_HASH_SECRET is set
  if (!process.env.PHONE_HASH_SECRET) {
    console.error('ERROR: PHONE_HASH_SECRET environment variable is not set');
    console.error('Please set it before running this migration:');
    console.error('  export PHONE_HASH_SECRET=your_secret_key');
    process.exit(1);
  }

  try {
    // Get all users with phone numbers (if phone column still exists)
    // Note: This will only work if phone column hasn't been dropped yet
    const users = await prisma.$queryRaw<Array<{ id: string; phone: string }>>`
      SELECT id, phone FROM "User" WHERE phone IS NOT NULL
    `;

    if (users.length === 0) {
      console.log('No users with phone numbers found. Migration complete.');
      return;
    }

    console.log(`Found ${users.length} users to migrate.`);

    // Hash each phone number and update
    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        const phoneHash = hashPhone(user.phone);
        
        await prisma.user.update({
          where: { id: user.id },
          data: { phoneHash },
        });

        successCount++;
        console.log(`✓ Migrated user ${user.id} (${user.phone.substring(0, 5)}...)`);
      } catch (error) {
        errorCount++;
        console.error(`✗ Error migrating user ${user.id}:`, error);
      }
    }

    console.log(`\nMigration complete!`);
    console.log(`  Success: ${successCount}`);
    console.log(`  Errors: ${errorCount}`);
    
    // Verify no NULL phoneHash values
    // Use raw query since Prisma doesn't easily support null checks in where clauses
    const nullCountResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "User" WHERE "phoneHash" IS NULL
    `;
    const nullCount = Number(nullCountResult[0]?.count || 0);

    if (nullCount > 0) {
      console.warn(`\nWARNING: ${nullCount} users still have NULL phoneHash.`);
      console.warn('You may need to handle these manually before making phoneHash non-nullable.');
    } else {
      console.log('\n✓ All users have phoneHash values. Safe to make phoneHash non-nullable.');
    }

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migratePhonesToHashes()
  .then(() => {
    console.log('Migration script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });

