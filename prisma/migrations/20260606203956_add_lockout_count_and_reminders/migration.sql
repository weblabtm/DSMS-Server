-- AlterTable
ALTER TABLE "AuthUser" ADD COLUMN     "lockoutCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reminder10mSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminder1hSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminder30mSent" BOOLEAN NOT NULL DEFAULT false;
