ALTER TABLE "ConversationMember" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "ConversationMember_userId_archivedAt_idx" ON "ConversationMember"("userId", "archivedAt");
