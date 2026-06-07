-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('BASIC', 'STANDARD', 'PREMIUM');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "faviconUrl" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "planExpiresAt" TIMESTAMP(3),
ADD COLUMN     "planTier" "PlanTier" NOT NULL DEFAULT 'BASIC',
ADD COLUMN     "primaryColor" TEXT,
ADD COLUMN     "secondaryColor" TEXT;
