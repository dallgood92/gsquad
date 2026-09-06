const express = require("express");

const {
  createMessageSchema,
  updateMessageSchema,
  reactionSchema,
} = require(
  "../validation/messageSchemas"
);

const router = express.Router();

const MESSAGE_PAGE_SIZE = 30;

const messageInclude = {
  sender: true,
  replyToMessage: {
    select: {
      id: true,
      text: true,
      deletedAt: true,
      sender: { select: { id: true, name: true } },
    },
  },
  reactions: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { id: "asc" },
  },
};

async function getRecipientUserIds(
  prisma,
  conversationId,
  senderUserId
) {
  const members =
    await prisma.conversationMember.findMany({
      where: {
        conversationId,
      },

      select: {
        userId: true,
      },
    });

  return members
    .map(
      (member) =>
        member.userId
    )
    .filter(
      (userId) =>
        userId !== senderUserId
    );
}

module.exports =
  function createMessageRoutes(
    prisma,
    redis
  ) {
    router.get(
      "/:conversationId/messages",
      async (req, res) => {
        try {
          const conversationId =
            Number(
              req.params
                .conversationId
            );

          if (
            !Number.isInteger(
              conversationId
            ) ||
            conversationId <= 0
          ) {
            return res
              .status(400)
              .json({
                error:
                  "Invalid conversation ID",
              });
          }

          const before =
            req.query.before
              ? Number(
                  req.query.before
                )
              : null;

          if (
            before !== null &&
            (
              !Number.isInteger(
                before
              ) ||
              before <= 0
            )
          ) {
            return res
              .status(400)
              .json({
                error:
                  "Invalid message cursor",
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
            return res
              .status(403)
              .json({
                error:
                  "You are not a member of this conversation",
              });
          }

          const messages =
            await prisma.message.findMany({
              where: {
                conversationId,

                ...(before && {
                  id: {
                    lt: before,
                  },
                }),
              },

              include: messageInclude,

              orderBy: {
                id: "desc",
              },

              take:
                MESSAGE_PAGE_SIZE +
                1,
            });

          const hasMore =
            messages.length >
            MESSAGE_PAGE_SIZE;

          if (hasMore) {
            messages.pop();
          }

          messages.reverse();

          const nextCursor =
            hasMore &&
            messages.length > 0
              ? messages[0].id
              : null;

          res.json({
            messages,
            hasMore,
            nextCursor,
          });
        } catch (error) {
          console.error(
            "Failed to get messages:",
            error
          );

          res.status(500).json({
            error:
              "Failed to get messages",
          });
        }
      }
    );

    router.post(
      "/:conversationId/messages",
      async (req, res) => {
        try {
          const conversationId =
            Number(
              req.params
                .conversationId
            );

          if (
            !Number.isInteger(
              conversationId
            ) ||
            conversationId <= 0
          ) {
            return res
              .status(400)
              .json({
                error:
                  "Invalid conversation ID",
              });
          }

          const result =
            createMessageSchema.safeParse(
              req.body
            );

          if (!result.success) {
            return res
              .status(400)
              .json({
                error:
                  "Invalid message",

                details:
                  result.error.issues,
              });
          }

          const { text, replyToMessageId } =
            result.data;

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
            return res
              .status(403)
              .json({
                error:
                  "You are not a member of this conversation",
              });
          }


          if (replyToMessageId) {
            const replyTarget = await prisma.message.findFirst({
              where: { id: replyToMessageId, conversationId },
            });

            if (!replyTarget) {
              return res.status(400).json({ error: "Reply target is not in this conversation" });
            }
          }

          const newMessage =
            await prisma.message.create({
              data: {
                text,
                senderId:
                  req.userId,
                conversationId,
                replyToMessageId: replyToMessageId ?? null,
              },

              include: messageInclude,
            });

          const recipientUserIds =
            await getRecipientUserIds(
              prisma,
              conversationId,
              req.userId
            );

          await redis.publishChatEvent({
            recipientUserIds,

            event: {
              type:
                "message_created",

              data: {
                message:
                  newMessage,
              },
            },
          });

          res
            .status(201)
            .json(newMessage);
        } catch (error) {
          console.error(
            "Failed to create message:",
            error
          );

          res.status(500).json({
            error:
              "Failed to create message",
          });
        }
      }
    );

    router.patch(
      "/:conversationId/messages/:messageId",
      async (req, res) => {
        try {
          const conversationId =
            Number(
              req.params
                .conversationId
            );

          const messageId =
            Number(
              req.params.messageId
            );

          if (
            !Number.isInteger(
              conversationId
            ) ||
            conversationId <= 0 ||
            !Number.isInteger(
              messageId
            ) ||
            messageId <= 0
          ) {
            return res
              .status(400)
              .json({
                error:
                  "Invalid conversation or message ID",
              });
          }

          const result =
            updateMessageSchema.safeParse(
              req.body
            );

          if (!result.success) {
            return res
              .status(400)
              .json({
                error:
                  "Invalid message",

                details:
                  result.error.issues,
              });
          }

          const message =
            await prisma.message.findFirst({
              where: {
                id: messageId,
                conversationId,
              },
            });

          if (!message) {
            return res
              .status(404)
              .json({
                error:
                  "Message not found",
              });
          }

          if (
            message.senderId !==
            req.userId
          ) {
            return res
              .status(403)
              .json({
                error:
                  "You can only edit your own messages",
              });
          }

          if (message.deletedAt) {
            return res
              .status(409)
              .json({
                error:
                  "Deleted messages cannot be edited",
              });
          }

          const updatedMessage =
            await prisma.message.update({
              where: {
                id: messageId,
              },

              data: {
                text:
                  result.data.text,

                editedAt:
                  new Date(),
              },

              include: messageInclude,
            });

          const recipientUserIds =
            await getRecipientUserIds(
              prisma,
              conversationId,
              req.userId
            );

          await redis.publishChatEvent({
            recipientUserIds,

            event: {
              type:
                "message_updated",

              data: {
                message:
                  updatedMessage,
              },
            },
          });

          res.json(
            updatedMessage
          );
        } catch (error) {
          console.error(
            "Failed to update message:",
            error
          );

          res.status(500).json({
            error:
              "Failed to update message",
          });
        }
      }
    );

    router.delete(
      "/:conversationId/messages/:messageId",
      async (req, res) => {
        try {
          const conversationId =
            Number(
              req.params
                .conversationId
            );

          const messageId =
            Number(
              req.params.messageId
            );

          if (
            !Number.isInteger(
              conversationId
            ) ||
            conversationId <= 0 ||
            !Number.isInteger(
              messageId
            ) ||
            messageId <= 0
          ) {
            return res
              .status(400)
              .json({
                error:
                  "Invalid conversation or message ID",
              });
          }

          const message =
            await prisma.message.findFirst({
              where: {
                id: messageId,
                conversationId,
              },
            });

          if (!message) {
            return res
              .status(404)
              .json({
                error:
                  "Message not found",
              });
          }

          if (
            message.senderId !==
            req.userId
          ) {
            return res
              .status(403)
              .json({
                error:
                  "You can only delete your own messages",
              });
          }

          if (message.deletedAt) {
            const existingMessage =
              await prisma.message.findUnique({
                where: {
                  id: messageId,
                },

                include: messageInclude,
              });

            return res.json(
              existingMessage
            );
          }

          const deletedMessage =
            await prisma.message.update({
              where: {
                id: messageId,
              },

              data: {
                deletedAt:
                  new Date(),
              },

              include: messageInclude,
            });

          const recipientUserIds =
            await getRecipientUserIds(
              prisma,
              conversationId,
              req.userId
            );

          await redis.publishChatEvent({
            recipientUserIds,

            event: {
              type:
                "message_deleted",

              data: {
                message:
                  deletedMessage,
              },
            },
          });

          res.json(
            deletedMessage
          );
        } catch (error) {
          console.error(
            "Failed to delete message:",
            error
          );

          res.status(500).json({
            error:
              "Failed to delete message",
          });
        }
      }
    );

    router.post(
      "/:conversationId/messages/:messageId/reactions",
      async (req, res) => {
        try {
          const conversationId = Number(req.params.conversationId);
          const messageId = Number(req.params.messageId);
          const result = reactionSchema.safeParse(req.body);

          if (!Number.isInteger(conversationId) || !Number.isInteger(messageId) || !result.success) {
            return res.status(400).json({ error: "Invalid reaction request" });
          }

          const membership = await prisma.conversationMember.findUnique({
            where: { userId_conversationId: { userId: req.userId, conversationId } },
          });
          const message = await prisma.message.findFirst({ where: { id: messageId, conversationId } });

          if (!membership) return res.status(403).json({ error: "You are not a member of this conversation" });
          if (!message || message.deletedAt) return res.status(404).json({ error: "Message not found" });

          const where = { messageId_userId_emoji: { messageId, userId: req.userId, emoji: result.data.emoji } };
          const existing = await prisma.messageReaction.findUnique({ where });

          if (existing) {
            await prisma.messageReaction.delete({ where });
          } else {
            await prisma.messageReaction.create({ data: { messageId, userId: req.userId, emoji: result.data.emoji } });
          }

          const updatedMessage = await prisma.message.findUnique({ where: { id: messageId }, include: messageInclude });
          const recipientUserIds = await getRecipientUserIds(prisma, conversationId, req.userId);
          await redis.publishChatEvent({
            recipientUserIds,
            event: { type: "message_updated", data: { message: updatedMessage } },
          });
          res.json(updatedMessage);
        } catch (error) {
          console.error("Failed to toggle reaction:", error);
          res.status(500).json({ error: "Failed to toggle reaction" });
        }
      }
    );

    return router;
  };
