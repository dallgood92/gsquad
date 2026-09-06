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

        if (requesterMembership?.role !== "ADMIN") {
          return res.status(403).json({
            error:
              "Only admins can add members",
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

  router.delete("/:conversationId/members/:userId", async (req, res) => {
    try {
      const conversationId = Number(req.params.conversationId);
      const userId = Number(req.params.userId);
      if (!Number.isInteger(conversationId) || !Number.isInteger(userId)) return res.status(400).json({ error: "Invalid conversation or user ID" });
      const requester = await prisma.conversationMember.findUnique({
        where: { userId_conversationId: { userId: req.userId, conversationId } },
      });
      const target = await prisma.conversationMember.findUnique({
        where: { userId_conversationId: { userId, conversationId } },
      });
      if (!requester || (req.userId !== userId && requester.role !== "ADMIN")) return res.status(403).json({ error: "You cannot remove this member" });
      if (!target) return res.status(404).json({ error: "Membership not found" });
      if (target.role === "ADMIN") {
        const adminCount = await prisma.conversationMember.count({ where: { conversationId, role: "ADMIN" } });
        if (adminCount === 1) return res.status(409).json({ error: "Assign another admin before the last admin leaves" });
      }
      await prisma.conversationMember.delete({ where: { userId_conversationId: { userId, conversationId } } });
      res.json({ success: true, userId, conversationId });
    } catch (error) {
      console.error("Failed to remove member:", error);
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  router.patch("/:conversationId/members/:userId/role", async (req, res) => {
    try {
      const conversationId = Number(req.params.conversationId);
      const userId = Number(req.params.userId);
      const role = req.body.role;
      if (!Number.isInteger(conversationId) || !Number.isInteger(userId) || !["ADMIN", "MEMBER"].includes(role)) {
        return res.status(400).json({ error: "Invalid role request" });
      }
      const requester = await prisma.conversationMember.findUnique({ where: { userId_conversationId: { userId: req.userId, conversationId } } });
      const target = await prisma.conversationMember.findUnique({ where: { userId_conversationId: { userId, conversationId } } });
      if (requester?.role !== "ADMIN") return res.status(403).json({ error: "Only admins can change roles" });
      if (!target) return res.status(404).json({ error: "Membership not found" });
      if (target.role === "ADMIN" && role === "MEMBER") {
        const adminCount = await prisma.conversationMember.count({ where: { conversationId, role: "ADMIN" } });
        if (adminCount === 1) return res.status(409).json({ error: "A conversation must keep at least one admin" });
      }
      const membership = await prisma.conversationMember.update({
        where: { userId_conversationId: { userId, conversationId } }, data: { role }, include: { user: true },
      });
      res.json(membership);
    } catch (error) {
      console.error("Failed to change member role:", error);
      res.status(500).json({ error: "Failed to change member role" });
    }
  });

  router.patch("/:conversationId/notification-preferences", async (req, res) => {
    try {
      const conversationId = Number(req.params.conversationId);
      const notificationsMuted = req.body.notificationsMuted;
      if (!Number.isInteger(conversationId) || typeof notificationsMuted !== "boolean") {
        return res.status(400).json({ error: "Invalid notification preferences" });
      }
      const existing = await prisma.conversationMember.findUnique({
        where: { userId_conversationId: { userId: req.userId, conversationId } },
      });
      if (!existing) return res.status(403).json({ error: "You are not a member of this conversation" });
      const membership = await prisma.conversationMember.update({
        where: { userId_conversationId: { userId: req.userId, conversationId } },
        data: { notificationsMuted },
        include: { user: true },
      });
      res.json(membership);
    } catch (error) {
      console.error("Failed to update notification preferences:", error);
      res.status(500).json({ error: "Failed to update notification preferences" });
    }
  });

  return router;
};
