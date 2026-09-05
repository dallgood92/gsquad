const express = require("express");

const {
  createMessageSchema,
} = require("../validation/messageSchemas");

const router = express.Router();

module.exports = function createMessageRoutes(
  prisma,
  redis
) {
  router.post(
    "/:conversationId/messages",
    async (req, res) => {
      try {
        const conversationId = Number(
          req.params.conversationId
        );

        if (
          !Number.isInteger(conversationId)
        ) {
          return res.status(400).json({
            error: "Invalid conversation ID",
          });
        }

        const result =
          createMessageSchema.safeParse(
            req.body
          );

        if (!result.success) {
          return res.status(400).json({
            error: "Invalid message",
            details: result.error.issues,
          });
        }

        const { text } = result.data;

        const membership =
          await prisma.conversationMember.findUnique(
            {
              where: {
                userId_conversationId: {
                  userId: req.userId,
                  conversationId,
                },
              },
            }
          );

        if (!membership) {
          return res.status(403).json({
            error:
              "You are not a member of this conversation",
          });
        }

        const newMessage =
          await prisma.message.create({
            data: {
              text,
              senderId: req.userId,
              conversationId,
            },

            include: {
              sender: true,
            },
          });

        const members =
          await prisma.conversationMember.findMany(
            {
              where: {
                conversationId,
              },

              select: {
                userId: true,
              },
            }
          );

        const recipientUserIds = members
          .map(
            (member) => member.userId
          )
          .filter(
            (userId) =>
              userId !== req.userId
          );

        await redis.publishChatEvent({
          recipientUserIds,

          event: {
            type: "message_created",

            data: {
              message: newMessage,
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

  return router;
};