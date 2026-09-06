ALTER TABLE "Conversation" ADD COLUMN "createdById" INTEGER;
UPDATE "Conversation" AS conversation
SET "createdById" = creator."userId"
FROM (
  SELECT DISTINCT ON ("conversationId") "conversationId", "userId"
  FROM "ConversationMember"
  WHERE "role" = 'ADMIN'
  ORDER BY "conversationId", "joinedAt" ASC
) AS creator
WHERE conversation."id" = creator."conversationId" AND conversation."type" = 'GROUP';
CREATE INDEX "Conversation_createdById_idx" ON "Conversation"("createdById");
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
