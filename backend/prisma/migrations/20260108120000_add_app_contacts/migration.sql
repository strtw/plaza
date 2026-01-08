-- CreateTable
CREATE TABLE "AppContact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plazaUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppContact_userId_phoneHash_key" ON "AppContact"("userId", "phoneHash");

-- CreateIndex
CREATE INDEX "AppContact_userId_idx" ON "AppContact"("userId");

-- CreateIndex
CREATE INDEX "AppContact_phoneHash_idx" ON "AppContact"("phoneHash");

-- CreateIndex
CREATE INDEX "AppContact_plazaUserId_idx" ON "AppContact"("plazaUserId");

-- AddForeignKey
ALTER TABLE "AppContact" ADD CONSTRAINT "AppContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppContact" ADD CONSTRAINT "AppContact_plazaUserId_fkey" FOREIGN KEY ("plazaUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
