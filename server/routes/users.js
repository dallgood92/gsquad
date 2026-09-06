const express = require("express");

const router = express.Router();

module.exports = function createUserRoutes(prisma) {
  router.patch("/me", async (req, res) => {
    try {
      const name = typeof req.body.name === "string" ? req.body.name.trim() : "";

      if (name.length < 1 || name.length > 40) {
        return res.status(400).json({ error: "Display name must be between 1 and 40 characters" });
      }

      const user = await prisma.user.update({
        where: { id: req.userId },
        data: { name },
        select: { id: true, name: true, email: true, avatarUrl: true },
      });

      res.json({ user });
    } catch (error) {
      console.error("Failed to update profile:", error);
      res.status(500).json({ error: "Failed to update display name" });
    }
  });

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
