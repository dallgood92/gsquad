const express = require("express");
const router = express.Router();

module.exports = function createNotificationRoutes(prisma) {
  router.get("/", async (req, res) => {
    try {
      const notifications = await prisma.notification.findMany({
        where: { userId: req.userId },
        include: {
          actor: { select: { id: true, name: true } },
          conversation: { select: { id: true, name: true } },
          message: { select: { id: true, text: true, replyToMessageId: true } },
        },
        orderBy: { id: "desc" },
        take: 50,
      });
      res.json({ notifications, unreadCount: notifications.filter((item) => !item.readAt).length });
    } catch (error) {
      console.error("Failed to get notifications:", error);
      res.status(500).json({ error: "Failed to get notifications" });
    }
  });

  router.patch("/read", async (req, res) => {
    try {
      await prisma.notification.updateMany({ where: { userId: req.userId, readAt: null }, data: { readAt: new Date() } });
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to mark notifications read:", error);
      res.status(500).json({ error: "Failed to mark notifications read" });
    }
  });

  router.delete("/:notificationId", async (req, res) => {
    try {
      const notificationId = Number(req.params.notificationId);
      if (!Number.isInteger(notificationId)) return res.status(400).json({ error: "Invalid notification" });
      await prisma.notification.deleteMany({ where: { id: notificationId, userId: req.userId } });
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to dismiss notification:", error);
      res.status(500).json({ error: "Failed to dismiss notification" });
    }
  });

  router.delete("/", async (req, res) => {
    try {
      await prisma.notification.deleteMany({ where: { userId: req.userId } });
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to clear notifications:", error);
      res.status(500).json({ error: "Failed to clear notifications" });
    }
  });

  return router;
};
