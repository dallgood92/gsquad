CREATE TABLE "MessagePin" (
    "id" SERIAL NOT NULL,
    "messageId" INTEGER NOT NULL,
    "pinnedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessagePin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessagePin_messageId_key" ON "MessagePin"("messageId");
CREATE INDEX "MessagePin_pinnedById_idx" ON "MessagePin"("pinnedById");
ALTER TABLE "MessagePin" ADD CONSTRAINT "MessagePin_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessagePin" ADD CONSTRAINT "MessagePin_pinnedById_fkey" FOREIGN KEY ("pinnedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
