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
  });

const updateMessageSchema =
  z.object({
    text: messageTextSchema,
  });

module.exports = {
  createMessageSchema,
  updateMessageSchema,
};