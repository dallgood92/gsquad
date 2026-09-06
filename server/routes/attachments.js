const express = require("express");

module.exports = function createAttachmentRoutes(prisma, storage) {
  const router = express.Router();

  router.post("/presign", async (req, res) => {
    try {
      const conversationId = Number(req.body.conversationId);
      const originalName = String(req.body.originalName || "").trim();
      const mimeType = String(req.body.mimeType || "").toLowerCase();
      const size = Number(req.body.size);
      if (!Number.isInteger(conversationId) || !originalName || originalName.length > 255) return res.status(400).json({ error: "Invalid attachment details" });
      const membership = await prisma.conversationMember.findUnique({ where: { userId_conversationId: { userId: req.userId, conversationId } } });
      if (!membership) return res.status(403).json({ error: "You are not a member of this conversation" });
      const upload = await storage.createUpload({ conversationId, userId: req.userId, originalName, mimeType, size });
      res.json(upload);
    } catch (error) {
      console.error("Failed to prepare attachment upload:", error);
      res.status(error.statusCode || 500).json({ error: error.message || "Failed to prepare attachment upload" });
    }
  });

  return router;
};
