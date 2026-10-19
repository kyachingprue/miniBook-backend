-- CreateEnum
CREATE TYPE "PrivacyLevel" AS ENUM ('PUBLIC', 'FRIENDS', 'PRIVATE');

-- CreateEnum
CREATE TYPE "PostVisibility" AS ENUM ('PUBLIC', 'FRIENDS', 'PRIVATE');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'FOLLOW_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'FOLLOW_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'MESSAGE';

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "privacy" "PrivacyLevel" NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

-- AlterTable Post
ALTER TABLE "Post" ADD COLUMN "visibility" "PostVisibility" NOT NULL DEFAULT 'PUBLIC';
CREATE INDEX "Post_visibility_idx" ON "Post"("visibility");

-- AlterTable Follow default to PENDING for new rows (existing stay ACCEPTED)
ALTER TABLE "Follow" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable ConversationMember
ALTER TABLE "ConversationMember" ADD COLUMN "lastReadAt" TIMESTAMP(3);
ALTER TABLE "ConversationMember" ADD COLUMN "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Index for unread notifications
CREATE INDEX "Notification_recipientId_read_idx" ON "Notification"("recipientId", "read");
