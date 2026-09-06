ALTER TABLE "Message" ADD COLUMN "replyToMessageId" INTEGER;

CREATE TABLE "MessageReaction" (
    "id" SERIAL NOT NULL,
    "emoji" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "messageId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Message_replyToMessageId_idx" ON "Message"("replyToMessageId");
CREATE INDEX "MessageReaction_messageId_idx" ON "MessageReaction"("messageId");
CREATE UNIQUE INDEX "MessageReaction_messageId_userId_emoji_key" ON "MessageReaction"("messageId", "userId", "emoji");

ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToMessageId_fkey" FOREIGN KEY ("replyToMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
