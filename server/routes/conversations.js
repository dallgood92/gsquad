const express = require("express");

const {
  createConversationSchema,
} = require("../validation/conversationSchemas");

const router = express.Router();

module.exports = function createConversationRoutes(
  prisma,
  redis,
  storage
) {
  router.get("/", async (req, res) => {
    try {
      const conversations =
        await prisma.conversation.findMany({
          where: {
            members: {
              some: {
                userId: req.userId,
                archivedAt: null,
              },
            },
          },

          include: {
            members: {
              include: {
                user: true,
              },
            },

            messages: {
              orderBy: {
                id: "desc",
              },

              take: 1,

              include: {
                sender: true,
              },
            },
          },
        });

      const conversationsWithDetails =
        await Promise.all(
          conversations.map(
            async (conversation) => {
              const currentMembership =
                conversation.members.find(
                  (membership) =>
                    membership.userId ===
                    req.userId
                );

              const lastReadMessageId =
                currentMembership
                  ?.lastReadMessageId;

              const unreadCount =
                await prisma.message.count({
                  where: {
                    conversationId:
                      conversation.id,

                    senderId: {
                      not: req.userId,
                    },

                    ...(lastReadMessageId && {
                      id: {
                        gt: lastReadMessageId,
                      },
                    }),
                  },
                });

              const lastMessage =
                conversation.messages[0] ??
                null;

              const {
                messages,
                ...conversationWithoutMessages
              } = conversation;

              return {
                ...conversationWithoutMessages,
                unreadCount,
                lastMessage,
              };
            }
          )
        );

      conversationsWithDetails.sort(
        (
          firstConversation,
          secondConversation
        ) => {
          const firstActivity =
            firstConversation.lastMessage
              ?.id ?? 0;

          const secondActivity =
            secondConversation.lastMessage
              ?.id ?? 0;

          if (
            firstActivity ===
            secondActivity
          ) {
            return (
              secondConversation.id -
              firstConversation.id
            );
          }

          return (
            secondActivity -
            firstActivity
          );
        }
      );

      res.json(
        conversationsWithDetails
      );
    } catch (error) {
      console.error(
        "Failed to get conversations:",
        error
      );

      res.status(500).json({
        error:
          "Failed to get conversations",
      });
    }
  });

  router.get("/archived", async (req, res) => {
    try {
      const memberships = await prisma.conversationMember.findMany({
        where: { userId: req.userId, archivedAt: { not: null } },
        include: { conversation: { select: { id: true, name: true, type: true, createdAt: true } } },
        orderBy: { archivedAt: "desc" },
      });
      res.json({ conversations: memberships.map((membership) => ({ ...membership.conversation, archivedAt: membership.archivedAt })) });
    } catch (error) {
      console.error("Failed to get archived conversations:", error);
      res.status(500).json({ error: "Failed to get archived conversations" });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const result =
        createConversationSchema.safeParse(
          req.body
        );

      if (!result.success) {
        return res.status(400).json({
          error:
            "Invalid conversation",
          details:
            result.error.issues,
        });
      }

      const { name } =
        result.data;

      const conversation =
        await prisma.conversation.create({
          data: {
            name,
            createdById: req.userId,

            members: {
              create: {
                userId:
                  req.userId,
                role: "ADMIN",
              },
            },
          },

          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
        });

      res.status(201).json({
        ...conversation,
        unreadCount: 0,
        lastMessage: null,
      });
    } catch (error) {
      console.error(
        "Failed to create conversation:",
        error
      );

      res.status(500).json({
        error:
          "Failed to create conversation",
      });
    }
  });

  router.post("/direct", async (req, res) => {
    try {
      const targetUserId = Number(req.body.userId);
      if (!Number.isInteger(targetUserId) || targetUserId <= 0 || targetUserId === req.userId) {
        return res.status(400).json({ error: "Invalid direct-message recipient" });
      }
      const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (!targetUser) return res.status(404).json({ error: "User not found" });

      const friendship = await prisma.friendship.findFirst({
        where: {
          status: "ACCEPTED",
          OR: [
            { userId: req.userId, friendId: targetUserId },
            { userId: targetUserId, friendId: req.userId },
          ],
        },
      });
      if (!friendship) return res.status(403).json({ error: "You can only message accepted friends" });

      const directKey = [req.userId, targetUserId].sort((a, b) => a - b).join(":");
      let conversation = await prisma.conversation.findUnique({
        where: { directKey },
        include: { members: { include: { user: true } } },
      });
      let wasCreated = false;

      if (!conversation) {
        wasCreated = true;
        conversation = await prisma.conversation.create({
          data: {
            name: targetUser.name,
            type: "DIRECT",
            directKey,
            members: {
              create: [
                { userId: req.userId, role: "ADMIN" },
                { userId: targetUserId, role: "ADMIN" },
              ],
            },
          },
          include: { members: { include: { user: true } } },
        });
        await redis.publishChatEvent({
          recipientUserIds: [targetUserId],
          event: { type: "conversation_added", data: { conversation: { ...conversation, unreadCount: 0, lastMessage: null } } },
        });
      } else {
        await prisma.$transaction([
          prisma.conversationMember.upsert({
            where: { userId_conversationId: { userId: req.userId, conversationId: conversation.id } },
            create: { userId: req.userId, conversationId: conversation.id, role: "ADMIN" },
            update: { archivedAt: null },
          }),
          prisma.conversationMember.upsert({
            where: { userId_conversationId: { userId: targetUserId, conversationId: conversation.id } },
            create: { userId: targetUserId, conversationId: conversation.id, role: "ADMIN" },
            update: { archivedAt: null },
          }),
        ]);

        conversation = await prisma.conversation.findUnique({
          where: { id: conversation.id },
          include: { members: { include: { user: true } } },
        });
      }

      res.status(wasCreated ? 201 : 200).json({ ...conversation, unreadCount: 0, lastMessage: null });
    } catch (error) {
      console.error("Failed to create direct conversation:", error);
      res.status(500).json({ error: "Failed to create direct conversation" });
    }
  });

  router.patch(
    "/:conversationId/read",
    async (req, res) => {
      try {
        const conversationId =
          Number(
            req.params.conversationId
          );

        const messageId =
          Number(
            req.body.messageId
          );

        if (
          !Number.isInteger(
            conversationId
          ) ||
          conversationId <= 0
        ) {
          return res.status(400).json({
            error:
              "Invalid conversation ID",
          });
        }

        if (
          !Number.isInteger(messageId) ||
          messageId <= 0
        ) {
          return res.status(400).json({
            error:
              "Invalid message ID",
          });
        }

        const membership =
          await prisma.conversationMember.findUnique({
            where: {
              userId_conversationId: {
                userId:
                  req.userId,
                conversationId,
              },
            },
          });

        if (!membership) {
          return res.status(403).json({
            error:
              "You are not a member of this conversation",
          });
        }

        const message =
          await prisma.message.findFirst({
            where: {
              id: messageId,
              conversationId,
            },

            select: {
              id: true,
            },
          });

        if (!message) {
          return res.status(404).json({
            error:
              "Message not found in this conversation",
          });
        }

        const updateResult = await prisma.conversationMember.updateMany({
          where: {
            userId:
              req.userId,

            conversationId,

            OR: [
              {
                lastReadMessageId:
                  null,
              },
              {
                lastReadMessageId: {
                  lt: messageId,
                },
              },
            ],
          },

          data: {
            lastReadMessageId:
              messageId,
          },
        });

        const updatedMembership =
          await prisma.conversationMember.findUnique({
            where: {
              userId_conversationId: {
                userId:
                  req.userId,
                conversationId,
              },
            },
          });

        if (updateResult.count > 0) {
          const recipients = await prisma.conversationMember.findMany({
            where: { conversationId, userId: { not: req.userId } },
            select: { userId: true },
          });

          await redis.publishChatEvent({
            recipientUserIds: recipients.map((member) => member.userId),
            event: {
              type: "conversation_read",
              data: { conversationId, userId: req.userId, messageId: updatedMembership.lastReadMessageId },
            },
          });
        }

        res.json(
          updatedMembership
        );
      } catch (error) {
        console.error(
          "Failed to mark conversation read:",
          error
        );

        res.status(500).json({
          error:
            "Failed to mark conversation read",
        });
      }
    }
  );

  router.patch("/:conversationId", async (req, res) => {
    try {
      const conversationId = Number(req.params.conversationId);
      const name = String(req.body.name ?? "").trim();
      if (!Number.isInteger(conversationId) || name.length < 1 || name.length > 100) {
        return res.status(400).json({ error: "Invalid conversation name" });
      }
      const membership = await prisma.conversationMember.findUnique({
        where: { userId_conversationId: { userId: req.userId, conversationId } },
      });
      if (membership?.role !== "ADMIN") return res.status(403).json({ error: "Only admins can rename this conversation" });
      const conversation = await prisma.conversation.update({ where: { id: conversationId }, data: { name } });
      res.json(conversation);
    } catch (error) {
      console.error("Failed to rename conversation:", error);
      res.status(500).json({ error: "Failed to rename conversation" });
    }
  });

  const deleteConversation = async (req, res) => {
    try {
      const conversationId = Number(req.params.conversationId);
      if (!Number.isInteger(conversationId)) return res.status(400).json({ error: "Invalid conversation" });
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { members: true },
      });
      if (!conversation) return res.status(404).json({ error: "Conversation not found" });
      const isMember = conversation.members.some((member) => member.userId === req.userId);
      if (conversation.type === "DIRECT" && !isMember) return res.status(403).json({ error: "You cannot delete this conversation" });
      if (conversation.type !== "DIRECT" && conversation.createdById !== req.userId) {
        return res.status(403).json({ error: "Only the group owner can delete this group" });
      }
      const recipientUserIds = conversation.members.map((member) => member.userId);
      const attachmentKeys = await prisma.messageAttachment.findMany({
        where: { message: { conversationId } },
        select: { storageKey: true },
      });
      await prisma.$transaction([
        prisma.notification.deleteMany({ where: { conversationId } }),
        prisma.message.updateMany({
          where: { conversationId, replyToMessageId: { not: null } },
          data: { replyToMessageId: null },
        }),
        prisma.messagePin.deleteMany({ where: { message: { conversationId } } }),
        prisma.messageReaction.deleteMany({ where: { message: { conversationId } } }),
        prisma.message.deleteMany({ where: { conversationId } }),
        prisma.conversationMember.deleteMany({ where: { conversationId } }),
        prisma.conversation.delete({ where: { id: conversationId } }),
      ]);
      await Promise.allSettled(attachmentKeys.map(({ storageKey }) => storage.deleteObject(storageKey)));
      await redis.publishChatEvent({
        recipientUserIds,
        event: { type: "conversation_deleted", data: { conversationId } },
      });
      res.json({ success: true, conversationId });
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  };

  router.delete("/:conversationId", deleteConversation);
  router.post("/:conversationId/delete", deleteConversation);

  return router;
};
