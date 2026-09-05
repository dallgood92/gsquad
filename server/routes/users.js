const express = require("express");

const router = express.Router();

module.exports = function createUserRoutes(prisma) {
  router.get("/", async (req, res) => {
    try {
      const search = req.query.search?.trim() || "";

      if (search.length < 2) {
        return res.json([]);
      }

      const users = await prisma.user.findMany({
        where: {
          AND: [
            {
              id: {
                not: req.userId,
              },
            },
            {
              OR: [
                {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  email: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            },
          ],
        },

        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },

        take: 10,
      });

      res.json(users);
    } catch (error) {
      console.error("Failed to search users:", error);

      res.status(500).json({
        error: "Failed to search users",
      });
    }
  });

  return router;
};