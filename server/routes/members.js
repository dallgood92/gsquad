const express = require("express");

const {
  addMemberSchema,
} = require("../validation/memberSchemas");

const router = express.Router();

module.exports = function createMemberRoutes(
  prisma,
  redis
) {
  router.post(
    "/:conversationId/members",
    async (req, res) => {
      try {
        const conversationId = Number(
          req.params.conversationId
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

        const result =
          addMemberSchema.safeParse(
            req.body
          );

        if (!result.success) {
          return res.status(400).json({
            error: "Invalid member",
            details: result.error.issues,
          });
        }

        const { userId } = result.data;

        const requesterMembership =
          await prisma.conversationMember.findUnique({
            where: {
              userId_conversationId: {
                userId: req.userId,
                conversationId,
              },
            },
          });

        if (!requesterMembership) {
          return res.status(403).json({
            error:
              "You are not a member of this conversation",
          });
        }

        const user =
          await prisma.user.findUnique({
            where: {
              id: userId,
            },
          });

        if (!user) {
          return res.status(404).json({
            error: "User not found",
          });
        }

        const existingMembership =
          await prisma.conversationMember.findUnique({
            where: {
              userId_conversationId: {
                userId,
                conversationId,
              },
            },
          });

        if (existingMembership) {
          return res.status(409).json({
            error:
              "User is already a member",
          });
        }

        const membership =
          await prisma.conversationMember.create({
            data: {
              userId,
              conversationId,
            },

            include: {
              user: true,
            },
          });

        const conversation =
          await prisma.conversation.findUnique({
            where: {
              id: conversationId,
            },

            include: {
              members: {
                include: {
                  user: true,
                },
              },
            },
          });

        await redis.publishChatEvent({
          recipientUserIds: [
            userId,
          ],

          event: {
            type:
              "conversation_added",

            data: {
              conversation: {
                ...conversation,
                unreadCount: 0,
              },
            },
          },
        });

        res
          .status(201)
          .json(membership);
      } catch (error) {
        console.error(
          "Failed to add conversation member:",
          error
        );

        res.status(500).json({
          error:
            "Failed to add conversation member",
        });
      }
    }
  );

  return router;
};