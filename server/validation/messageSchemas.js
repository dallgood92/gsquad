const { z } = require("zod");

const messageTextSchema =
  z
    .string()
    .trim()
    .min(
      1,
      "Message cannot be empty"
    )
    .max(
      2000,
      "Message cannot exceed 2000 characters"
    );

const createMessageSchema =
  z.object({
    text: messageTextSchema,
    replyToMessageId: z.number().int().positive().nullable().optional(),
  });

const updateMessageSchema =
  z.object({
    text: messageTextSchema,
  });

const reactionSchema = z.object({
  emoji: z.string().trim().min(1).max(16),
});

module.exports = {
  createMessageSchema,
  updateMessageSchema,
  reactionSchema,
};
