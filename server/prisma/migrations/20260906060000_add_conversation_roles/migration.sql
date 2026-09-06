CREATE TYPE "MembershipRole" AS ENUM ('ADMIN', 'MEMBER');
ALTER TABLE "ConversationMember" ADD COLUMN "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER';

UPDATE "ConversationMember" AS member
SET "role" = 'ADMIN'
WHERE member."userId" = (
  SELECT MIN(first_member."userId")
  FROM "ConversationMember" AS first_member
  WHERE first_member."conversationId" = member."conversationId"
);
