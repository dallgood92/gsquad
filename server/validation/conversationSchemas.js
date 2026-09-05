const { z } = require("zod");

const createConversationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Conversation name is required")
    .max(100, "Conversation name cannot exceed 100 characters"),
});

module.exports = {
  createConversationSchema,
};