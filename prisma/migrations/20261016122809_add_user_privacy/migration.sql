-- DropIndex
DROP INDEX "Follow_followingId_idx";

-- AlterTable
ALTER TABLE "Follow" ALTER COLUMN "updatedAt" DROP DEFAULT;
