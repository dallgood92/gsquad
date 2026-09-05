const express = require("express");

const {
  createConversationSchema,
} = require("../validation/conversationSchemas");

const router = express.Router();

module.exports = function createConversationRoutes(prisma) {
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
        error: "Failed to get conversations",
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

  return router;
};