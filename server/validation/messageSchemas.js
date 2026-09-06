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
    text: z.string().trim().max(2000, "Message cannot exceed 2000 characters").default(""),
    replyToMessageId: z.number().int().positive().nullable().optional(),
    attachment: z.object({
      storageKey: z.string().min(1).max(500),
      originalName: z.string().min(1).max(255),
      mimeType: z.string().min(1).max(100),
      size: z.number().int().positive(),
      width: z.number().int().positive().nullable().optional(),
      height: z.number().int().positive().nullable().optional(),
      duration: z.number().nonnegative().nullable().optional(),
    }).nullable().optional(),
  }).refine((value) => value.text.length > 0 || value.attachment, { message: "Message or attachment required" });

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
