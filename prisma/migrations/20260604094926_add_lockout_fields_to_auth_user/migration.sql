-- AlterTable
ALTER TABLE "AuthUser" ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "unlockToken" TEXT,
ADD COLUMN     "unlockTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "AuthUser_unlockToken_key" ON "AuthUser"("unlockToken");

