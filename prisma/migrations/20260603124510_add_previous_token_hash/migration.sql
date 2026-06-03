-- AlterTable
ALTER TABLE "AuthSession" ADD COLUMN     "previousTokenHash" TEXT;

-- CreateIndex
CREATE INDEX "AuthSession_previousTokenHash_idx" ON "AuthSession"("previousTokenHash");
