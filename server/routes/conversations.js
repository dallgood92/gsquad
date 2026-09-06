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
          },

          orderBy: {
            createdAt: "asc",
          },
        });

      res.json(conversations);
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
          error: "Invalid conversation",
          details: result.error.issues,
        });
      }

      const { name } = result.data;

      const conversation =
        await prisma.conversation.create({
          data: {
            name,

            members: {
              create: {
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
          },
        });

      res
        .status(201)
        .json(conversation);
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
        const conversationId = Number(
          req.params.conversationId
        );

        const messageId = Number(
          req.body.messageId
        );

        if (
          !Number.isInteger(
            conversationId
          )
        ) {
          return res.status(400).json({
            error:
              "Invalid conversation ID",
          });
        }

        if (!Number.isInteger(messageId)) {
          return res.status(400).json({
            error: "Invalid message ID",
          });
        }

        const membership =
          await prisma.conversationMember.findUnique({
            where: {
              userId_conversationId: {
                userId: req.userId,
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
          });

        if (!message) {
          return res.status(404).json({
            error:
              "Message not found in this conversation",
          });
        }

        if (
          membership.lastReadMessageId !==
            null &&
          messageId <=
            membership.lastReadMessageId
        ) {
          return res.json(membership);
        }

        const updatedMembership =
          await prisma.conversationMember.update({
            where: {
              userId_conversationId: {
                userId: req.userId,
                conversationId,
              },
            },

            data: {
              lastReadMessageId:
                messageId,
            },
          });

        res.json(updatedMembership);
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

  return router;
};