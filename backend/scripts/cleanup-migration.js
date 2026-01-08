/**
 * Script to clean up failed migration in Railway database
 * Run with: railway run node scripts/cleanup-migration.js
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanup() {
  try {
    console.log('Checking for failed migrations...');
    
    // Check what failed migrations exist
    const failedMigrations = await prisma.$queryRaw`
      SELECT "migration_name", "started_at", "finished_at", "logs"
      FROM "_prisma_migrations"
      WHERE "finished_at" IS NULL
      ORDER BY "started_at" DESC
    `;
    
    console.log('Found failed migrations:', JSON.stringify(failedMigrations, null, 2));
    
    // Update the failed migration
    const result = await prisma.$executeRaw`
      UPDATE "_prisma_migrations"
      SET 
        "finished_at" = NOW(),
        "logs" = 'Resolved: Migration was rolled back. SelectedContact table never existed.'
      WHERE 
        "migration_name" = '20260108000001_rename_selected_contact_to_app_contact'
        AND "finished_at" IS NULL
    `;
    
    console.log(`Updated ${result} row(s)`);
    
    // Verify
    const verify = await prisma.$queryRaw`
      SELECT "migration_name", "finished_at", "logs"
      FROM "_prisma_migrations"
      WHERE "migration_name" = '20260108000001_rename_selected_contact_to_app_contact'
    `;
    
    console.log('Verification:', JSON.stringify(verify, null, 2));
    console.log('✓ Cleanup complete!');
    
  } catch (error) {
    console.error('Error:', error);
    // Don't exit with error - allow migrations to proceed even if cleanup fails
    // (in case the migration was already resolved or doesn't exist)
    console.log('Continuing with migrations...');
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
