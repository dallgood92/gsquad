const express = require("express");

const router = express.Router();
const SEARCH_RESULT_LIMIT = 30;

module.exports = function createSearchRoutes(prisma) {
  router.get("/messages", async (req, res) => {
    try {
      const query = String(req.query.q ?? "").trim();

      if (query.length < 2 || query.length > 100) {
        return res.status(400).json({ error: "Search must be between 2 and 100 characters" });
      }

      const messages = await prisma.message.findMany({
        where: {
          deletedAt: null,
          text: { contains: query, mode: "insensitive" },
          conversation: { members: { some: { userId: req.userId } } },
        },
        include: {
          sender: { select: { id: true, name: true } },
          conversation: { select: { id: true, name: true } },
          replyToMessage: {
            select: {
              id: true,
              text: true,
              deletedAt: true,
              sender: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { id: "desc" },
        take: SEARCH_RESULT_LIMIT,
      });

      res.json({ messages });
    } catch (error) {
      console.error("Failed to search messages:", error);
      res.status(500).json({ error: "Failed to search messages" });
    }
  });

  return router;
};
