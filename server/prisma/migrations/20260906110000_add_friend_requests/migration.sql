CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED');
ALTER TABLE "Friendship" ADD COLUMN "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING';
UPDATE "Friendship" SET "status" = 'ACCEPTED';
