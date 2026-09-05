const { z } = require("zod");

const addMemberSchema = z.object({
  userId: z
    .number()
    .int()
    .positive("User ID must be positive"),
});

module.exports = {
  addMemberSchema,
};