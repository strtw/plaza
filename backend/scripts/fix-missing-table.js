/**
 * Fix missing AppContact table
 * If migration is recorded but table doesn't exist, create the table manually
 * Run with: railway run node scripts/fix-missing-table.js
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixTable() {
  try {
    console.log('Checking AppContact table status...');
    
    // Check if table exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'AppContact'
      )
    `;
    
    const exists = tableExists[0]?.exists || false;
    console.log(`AppContact table exists: ${exists}`);
    
    if (!exists) {
      console.log('Table does not exist. Creating it...');
      
      // Create the table
      await prisma.$executeRaw`
        CREATE TABLE "AppContact" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "phoneHash" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "plazaUserId" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "AppContact_pkey" PRIMARY KEY ("id")
        )
      `;
      
      // Create indexes
      await prisma.$executeRaw`
        CREATE UNIQUE INDEX "AppContact_userId_phoneHash_key" ON "AppContact"("userId", "phoneHash")
      `;
      await prisma.$executeRaw`
        CREATE INDEX "AppContact_userId_idx" ON "AppContact"("userId")
      `;
      await prisma.$executeRaw`
        CREATE INDEX "AppContact_phoneHash_idx" ON "AppContact"("phoneHash")
      `;
      await prisma.$executeRaw`
        CREATE INDEX "AppContact_plazaUserId_idx" ON "AppContact"("plazaUserId")
      `;
      
      // Create foreign keys
      await prisma.$executeRaw`
        ALTER TABLE "AppContact" ADD CONSTRAINT "AppContact_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      `;
      await prisma.$executeRaw`
        ALTER TABLE "AppContact" ADD CONSTRAINT "AppContact_plazaUserId_fkey" 
        FOREIGN KEY ("plazaUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
      `;
      
      console.log('✓ AppContact table created successfully!');
    } else {
      console.log('✓ AppContact table already exists');
    }
    
    // Verify
    const verify = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'AppContact'
      )
    `;
    console.log(`Verification - Table exists: ${verify[0]?.exists}`);
    
  } catch (error) {
    console.error('Error:', error);
    // Don't exit with error - allow app to start
    console.log('Continuing...');
  } finally {
    await prisma.$disconnect();
  }
}

fixTable();
