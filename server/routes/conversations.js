const express = require("express");

const {
  createConversationSchema,
} = require("../validation/conversationSchemas");

const router = express.Router();

module.exports = function createConversationRoutes(
  prisma
) {
  router.get("/", async (req, res) => {
    try {
      const conversations =
        await prisma.conversation.findMany({
          where: {
            members: {
              some: {
                userId: req.userId,
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

        await prisma.conversationMember.updateMany({
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

  return router;
};
