const express = require("express");

const router = express.Router();

// Requests stay directional until accepted; accepted friendships are shared.
module.exports = function createFriendRoutes(prisma, redis) {
  const removeDirectConversations = async (firstUserId, secondUserId) => {
    const directKey = [firstUserId, secondUserId].sort((a, b) => a - b).join(":");
    const conversations = await prisma.conversation.findMany({
      where: { type: "DIRECT", directKey },
      include: { members: { select: { userId: true } } },
    });

    for (const conversation of conversations) {
      await prisma.$transaction([
        prisma.notification.deleteMany({ where: { conversationId: conversation.id } }),
        prisma.message.updateMany({
          where: { conversationId: conversation.id, replyToMessageId: { not: null } },
          data: { replyToMessageId: null },
        }),
        prisma.message.deleteMany({ where: { conversationId: conversation.id } }),
        prisma.conversationMember.deleteMany({ where: { conversationId: conversation.id } }),
        prisma.conversation.delete({ where: { id: conversation.id } }),
      ]);
      await redis.publishChatEvent({
        recipientUserIds: conversation.members.map((member) => member.userId),
        event: { type: "conversation_deleted", data: { conversationId: conversation.id } },
      });
    }
  };

  router.get("/", async (req, res) => {
    try {
      const friendships = await prisma.friendship.findMany({
        where: { status: "ACCEPTED", OR: [{ userId: req.userId }, { friendId: req.userId }] },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          friend: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });
      const friends = friendships.map((friendship) => friendship.userId === req.userId ? friendship.friend : friendship.user);
      friends.sort((first, second) => first.name.localeCompare(second.name));
      res.json(friends);
    } catch (error) {
      console.error("Failed to load friends:", error);
      res.status(500).json({ error: "Failed to load friends" });
    }
  });

  router.get("/requests", async (req, res) => {
    try {
      const requests = await prisma.friendship.findMany({
        where: { status: "PENDING", OR: [{ userId: req.userId }, { friendId: req.userId }] },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          friend: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });
      const blockedIds = new Set((await prisma.userBlock.findMany({
        where: { blockerId: req.userId },
        select: { blockedId: true },
      })).map((block) => block.blockedId));
      res.json({
        sent: requests.filter((request) => request.userId === req.userId).map((request) => request.friend),
        received: requests.filter((request) => request.friendId === req.userId && !blockedIds.has(request.userId)).map((request) => request.user),
      });
    } catch (error) {
      console.error("Failed to load friend requests:", error);
      res.status(500).json({ error: "Failed to load friend requests" });
    }
  });

  router.get("/blocked", async (req, res) => {
    try {
      const blocks = await prisma.userBlock.findMany({
        where: { blockerId: req.userId },
        include: { blocked: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
      });
      res.json(blocks.map((block) => block.blocked));
    } catch (error) {
      console.error("Failed to load blocked users:", error);
      res.status(500).json({ error: "Failed to load blocked users" });
    }
  });

  router.post("/:friendId", async (req, res) => {
    try {
      const friendId = Number(req.params.friendId);
      if (!Number.isInteger(friendId) || friendId <= 0 || friendId === req.userId) {
        return res.status(400).json({ error: "Invalid friend" });
      }
      const friend = await prisma.user.findUnique({ where: { id: friendId } });
      if (!friend) return res.status(404).json({ error: "User not found" });
      const outgoingBlock = await prisma.userBlock.findUnique({
        where: { blockerId_blockedId: { blockerId: req.userId, blockedId: friendId } },
      });
      if (outgoingBlock) return res.status(409).json({ error: "Unblock this person before sending a friend request" });
      const existing = await prisma.friendship.findFirst({
        where: { OR: [{ userId: req.userId, friendId }, { userId: friendId, friendId: req.userId }] },
      });
      if (existing) return res.status(409).json({ error: existing.status === "ACCEPTED" ? "Already friends" : "Friend request already pending" });
      await prisma.friendship.create({ data: { userId: req.userId, friendId, status: "PENDING" } });
      const isSilentlyBlocked = await prisma.userBlock.findUnique({
        where: { blockerId_blockedId: { blockerId: friendId, blockedId: req.userId } },
      });
      if (!isSilentlyBlocked) {
        await redis.publishChatEvent({ recipientUserIds: [friendId], event: { type: "friend_request_received", data: { userId: req.userId } } });
      }
      res.status(201).json({ friend: { id: friend.id, name: friend.name, email: friend.email, avatarUrl: friend.avatarUrl }, status: "PENDING" });
    } catch (error) {
      console.error("Failed to add friend:", error);
      res.status(500).json({ error: "Failed to add friend" });
    }
  });

  router.patch("/:friendId/accept", async (req, res) => {
    try {
      const friendId = Number(req.params.friendId);
      const request = await prisma.friendship.findUnique({ where: { userId_friendId: { userId: friendId, friendId: req.userId } } });
      if (!request || request.status !== "PENDING") return res.status(404).json({ error: "Friend request not found" });
      const block = await prisma.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId: req.userId, blockedId: friendId } } });
      if (block) return res.status(404).json({ error: "Friend request not found" });
      const acceptingUser = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, name: true },
      });
      await prisma.$transaction([
        prisma.friendship.update({ where: { userId_friendId: { userId: friendId, friendId: req.userId } }, data: { status: "ACCEPTED" } }),
        prisma.notification.create({
          data: { type: "FRIEND_ACCEPTED", userId: friendId, actorId: req.userId },
        }),
      ]);
      await redis.publishChatEvent({ recipientUserIds: [friendId], event: { type: "friend_request_accepted", data: { user: acceptingUser } } });
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to accept friend request:", error);
      res.status(500).json({ error: "Failed to accept friend request" });
    }
  });

  router.delete("/:friendId", async (req, res) => {
    const friendId = Number(req.params.friendId);
    if (!Number.isInteger(friendId)) return res.status(400).json({ error: "Invalid friend" });
    await prisma.friendship.deleteMany({ where: { OR: [{ userId: req.userId, friendId }, { userId: friendId, friendId: req.userId }] } });
    await removeDirectConversations(req.userId, friendId);
    await redis.publishChatEvent({
      recipientUserIds: [req.userId, friendId],
      event: { type: "friend_relationship_updated", data: { userId: req.userId, friendId } },
    });
    res.json({ success: true });
  });

  router.post("/:friendId/block", async (req, res) => {
    try {
      const friendId = Number(req.params.friendId);
      if (!Number.isInteger(friendId) || friendId <= 0 || friendId === req.userId) return res.status(400).json({ error: "Invalid user" });
      const user = await prisma.user.findUnique({ where: { id: friendId }, select: { id: true } });
      if (!user) return res.status(404).json({ error: "User not found" });
      const incomingPendingRequest = await prisma.friendship.findUnique({
        where: { userId_friendId: { userId: friendId, friendId: req.userId } },
      });
      await prisma.$transaction([
        prisma.friendship.deleteMany({ where: { OR: [{ userId: req.userId, friendId }, { userId: friendId, friendId: req.userId }] } }),
        prisma.userBlock.upsert({
          where: { blockerId_blockedId: { blockerId: req.userId, blockedId: friendId } },
          create: { blockerId: req.userId, blockedId: friendId },
          update: {},
        }),
      ]);
      if (incomingPendingRequest?.status === "PENDING") {
        await prisma.friendship.create({
          data: { userId: friendId, friendId: req.userId, status: "PENDING" },
        });
      }
      await removeDirectConversations(req.userId, friendId);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to block user:", error);
      res.status(500).json({ error: "Failed to block user" });
    }
  });

  router.delete("/:friendId/block", async (req, res) => {
    try {
      const friendId = Number(req.params.friendId);
      if (!Number.isInteger(friendId)) return res.status(400).json({ error: "Invalid user" });
      await prisma.userBlock.deleteMany({ where: { blockerId: req.userId, blockedId: friendId } });
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to unblock user:", error);
      res.status(500).json({ error: "Failed to unblock user" });
    }
  });

  return router;
};
