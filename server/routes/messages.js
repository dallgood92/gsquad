const express = require("express");

const {
  createMessageSchema,
  updateMessageSchema,
  reactionSchema,
} = require(
  "../validation/messageSchemas"
);

const router = express.Router();

const MESSAGE_PAGE_SIZE = 30;

const messageInclude = {
  sender: true,
  replyToMessage: {
    select: {
      id: true,
      text: true,
      deletedAt: true,
      sender: { select: { id: true, name: true } },
    },
  },
  reactions: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { id: "asc" },
  },
  pins: {
    include: { pinnedBy: { select: { id: true, name: true } } },
  },
  attachments: true,
};

async function withAttachmentUrls(message, storage) {
  return {
    ...message,
    attachments: await Promise.all((message.attachments || []).map(async (attachment) => ({
      ...attachment,
      url: await storage.getDownloadUrl(attachment.storageKey),
    }))),
  };
}

async function getRecipientUserIds(
  prisma,
  conversationId
) {
  const members =
    await prisma.conversationMember.findMany({
      where: {
        conversationId,
      },

      select: {
        userId: true,
      },
    });

  return members.map(
    (member) => member.userId
  );
}

module.exports =
  function createMessageRoutes(
    prisma,
    redis,
    storage
  ) {
    router.get(
      "/:conversationId/messages",
      async (req, res) => {
        try {
          const conversationId =
            Number(
              req.params
                .conversationId
            );

          if (
            !Number.isInteger(
              conversationId
            ) ||
            conversationId <= 0
          ) {
            return res
              .status(400)
              .json({
                error:
                  "Invalid conversation ID",
              });
          }

          const before =
            req.query.before
              ? Number(
                  req.query.before
                )
              : null;

          if (
            before !== null &&
            (
              !Number.isInteger(
                before
              ) ||
              before <= 0
            )
          ) {
            return res
              .status(400)
              .json({
                error:
                  "Invalid message cursor",
              });
          }

          const membership =
            await prisma.conversationMember.findUnique({
              where: {
                userId_conversationId: {
                  userId:
                    req.userId,

                  conversationId,
                },
              },
            });

          if (!membership) {
            return res
              .status(403)
              .json({
                error:
                  "You are not a member of this conversation",
              });
          }

          const messages =
            await prisma.message.findMany({
              where: {
                conversationId,

                ...(before && {
                  id: {
                    lt: before,
                  },
                }),
              },

              include: messageInclude,

              orderBy: {
                id: "desc",
              },

              take:
                MESSAGE_PAGE_SIZE +
                1,
            });

          const hasMore =
            messages.length >
            MESSAGE_PAGE_SIZE;

          if (hasMore) {
            messages.pop();
          }

          messages.reverse();

          const nextCursor =
            hasMore &&
            messages.length > 0
              ? messages[0].id
              : null;

          res.json({
            messages: storage.configured ? await Promise.all(messages.map((message) => withAttachmentUrls(message, storage))) : messages,
            hasMore,
            nextCursor,
          });
        } catch (error) {
          console.error(
            "Failed to get messages:",
            error
          );

          res.status(500).json({
            error:
              "Failed to get messages",
          });
        }
      }
    );

    router.post(
      "/:conversationId/messages",
      async (req, res) => {
        try {
          const conversationId =
            Number(
              req.params
                .conversationId
            );

          if (
            !Number.isInteger(
              conversationId
            ) ||
            conversationId <= 0
          ) {
            return res
              .status(400)
              .json({
                error:
                  "Invalid conversation ID",
              });
          }

          const result =
            createMessageSchema.safeParse(
              req.body
            );

          if (!result.success) {
            return res
              .status(400)
              .json({
                error:
                  "Invalid message",

                details:
                  result.error.issues,
              });
          }

          const { text, replyToMessageId, attachment } =
            result.data;

          const membership =
            await prisma.conversationMember.findUnique({
              where: {
                userId_conversationId: {
                  userId:
                    req.userId,

                  conversationId,
                },
              },
            });

          if (!membership) {
            return res
              .status(403)
              .json({
                error:
                  "You are not a member of this conversation",
              });
          }

          const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            select: { type: true, members: { select: { userId: true } } },
          });

          if (conversation?.type === "DIRECT") {
            const otherUserId = conversation.members.find((member) => member.userId !== req.userId)?.userId;
            const friendship = otherUserId && await prisma.friendship.findFirst({
              where: {
                status: "ACCEPTED",
                OR: [
                  { userId: req.userId, friendId: otherUserId },
                  { userId: otherUserId, friendId: req.userId },
                ],
              },
            });
            if (!friendship) return res.status(403).json({ error: "You can only message accepted friends" });
          }


          if (replyToMessageId) {
            const replyTarget = await prisma.message.findFirst({
              where: { id: replyToMessageId, conversationId },
            });

            if (!replyTarget) {
              return res.status(400).json({ error: "Reply target is not in this conversation" });
            }
          }

          if (attachment) {
            const expectedPrefix = `conversations/${conversationId}/${req.userId}/`;
            if (!attachment.storageKey.startsWith(expectedPrefix)) return res.status(400).json({ error: "Invalid attachment upload" });
            storage.validateFile(attachment);
            await storage.verifyUpload(attachment);
          }

          const newMessage =
            await prisma.message.create({
              data: {
                text,
                senderId:
                  req.userId,
                conversationId,
                replyToMessageId: replyToMessageId ?? null,
                ...(attachment && { attachments: { create: attachment } }),
              },

              include: messageInclude,
            });

          const messageForDelivery = attachment ? await withAttachmentUrls(newMessage, storage) : newMessage;
          const mentionableMembers = await prisma.conversationMember.findMany({
            where: { conversationId, userId: { not: req.userId } },
            include: { user: { select: { id: true, name: true } } },
          });
          const normalizedText = text.toLocaleLowerCase();
          const mentionedUserIds = mentionableMembers
            .filter(({ user, notificationsMuted }) =>
              !notificationsMuted && normalizedText.includes(`@${user.name.toLocaleLowerCase()}`)
            )
            .map(({ userId }) => userId);

          if (mentionedUserIds.length) {
            await prisma.notification.createMany({
              data: mentionedUserIds.map((userId) => ({ userId, actorId: req.userId, conversationId, messageId: newMessage.id })),
              skipDuplicates: true,
            });
            await redis.publishChatEvent({
              recipientUserIds: mentionedUserIds,
              event: { type: "mention_notification", data: { conversationId, messageId: newMessage.id } },
            });
          }

          const recipientUserIds =
            await getRecipientUserIds(
              prisma,
              conversationId,
              req.userId
            );

          await redis.publishChatEvent({
            recipientUserIds,

            event: {
              type:
                "message_created",

              data: {
                message:
                  messageForDelivery,
              },
            },
          });

          res
            .status(201)
            .json(messageForDelivery);
        } catch (error) {
          console.error(
            "Failed to create message:",
            error
          );

          res.status(500).json({
            error:
              "Failed to create message",
          });
        }
      }
    );

    router.get(
      "/:conversationId/messages/:messageId/thread",
      async (req, res) => {
        try {
          const conversationId = Number(req.params.conversationId);
          const messageId = Number(req.params.messageId);
          if (!Number.isInteger(conversationId) || !Number.isInteger(messageId)) {
            return res.status(400).json({ error: "Invalid conversation or message ID" });
          }
          const membership = await prisma.conversationMember.findUnique({
            where: { userId_conversationId: { userId: req.userId, conversationId } },
          });
          if (!membership) return res.status(403).json({ error: "You are not a member of this conversation" });
          const message = await prisma.message.findFirst({
            where: { id: messageId, conversationId },
            include: { ...messageInclude, replies: { include: messageInclude, orderBy: { id: "asc" } } },
          });
          if (!message) return res.status(404).json({ error: "Message not found" });
          const root = storage.configured ? await withAttachmentUrls(message, storage) : message;
          root.replies = storage.configured ? await Promise.all(message.replies.map((reply) => withAttachmentUrls(reply, storage))) : message.replies;
          res.json(root);
        } catch (error) {
          console.error("Failed to get thread:", error);
          res.status(500).json({ error: "Failed to get thread" });
        }
      }
    );

    router.patch(
      "/:conversationId/messages/:messageId",
      async (req, res) => {
        try {
          const conversationId =
            Number(
              req.params
                .conversationId
            );

          const messageId =
            Number(
              req.params.messageId
            );

          if (
            !Number.isInteger(
              conversationId
            ) ||
            conversationId <= 0 ||
            !Number.isInteger(
              messageId
            ) ||
            messageId <= 0
          ) {
            return res
              .status(400)
              .json({
                error:
                  "Invalid conversation or message ID",
              });
          }

          const result =
            updateMessageSchema.safeParse(
              req.body
            );

          if (!result.success) {
            return res
              .status(400)
              .json({
                error:
                  "Invalid message",

                details:
                  result.error.issues,
              });
          }

          const message =
            await prisma.message.findFirst({
              where: {
                id: messageId,
                conversationId,
              },
              include: { attachments: true },
            });

          if (!message) {
            return res
              .status(404)
              .json({
                error:
                  "Message not found",
              });
          }

          if (
            message.senderId !==
            req.userId
          ) {
            return res
              .status(403)
              .json({
                error:
                  "You can only edit your own messages",
              });
          }

          if (message.deletedAt) {
            return res
              .status(409)
              .json({
                error:
                  "Deleted messages cannot be edited",
              });
          }

          await Promise.allSettled(message.attachments.map(({ storageKey }) => storage.deleteObject(storageKey)));
          await prisma.messageAttachment.deleteMany({ where: { messageId } });

          const updatedMessage =
            await prisma.message.update({
              where: {
                id: messageId,
              },

              data: {
                text:
                  result.data.text,

                editedAt:
                  new Date(),
              },

              include: messageInclude,
            });

          const updatedForDelivery = storage.configured ? await withAttachmentUrls(updatedMessage, storage) : updatedMessage;
          const recipientUserIds =
            await getRecipientUserIds(
              prisma,
              conversationId,
              req.userId
            );

          await redis.publishChatEvent({
            recipientUserIds,

            event: {
              type:
                "message_updated",

              data: {
                message:
                  updatedForDelivery,
              },
            },
          });

          res.json(
            updatedForDelivery
          );
        } catch (error) {
          console.error(
            "Failed to update message:",
            error
          );

          res.status(500).json({
            error:
              "Failed to update message",
          });
        }
      }
    );

    router.delete(
      "/:conversationId/messages/:messageId",
      async (req, res) => {
        try {
          const conversationId =
            Number(
              req.params
                .conversationId
            );

          const messageId =
            Number(
              req.params.messageId
            );

          if (
            !Number.isInteger(
              conversationId
            ) ||
            conversationId <= 0 ||
            !Number.isInteger(
              messageId
            ) ||
            messageId <= 0
          ) {
            return res
              .status(400)
              .json({
                error:
                  "Invalid conversation or message ID",
              });
          }

          const message =
            await prisma.message.findFirst({
              where: {
                id: messageId,
                conversationId,
              },
            });

          if (!message) {
            return res
              .status(404)
              .json({
                error:
                  "Message not found",
              });
          }

          if (
            message.senderId !==
            req.userId
          ) {
            return res
              .status(403)
              .json({
                error:
                  "You can only delete your own messages",
              });
          }

          if (message.deletedAt) {
            const existingMessage =
              await prisma.message.findUnique({
                where: {
                  id: messageId,
                },

                include: messageInclude,
              });

            return res.json(storage.configured ? await withAttachmentUrls(existingMessage, storage) : existingMessage);
          }

          const deletedMessage =
            await prisma.message.update({
              where: {
                id: messageId,
              },

              data: {
                deletedAt:
                  new Date(),
              },

              include: messageInclude,
            });

          const deletedForDelivery = storage.configured ? await withAttachmentUrls(deletedMessage, storage) : deletedMessage;
          const recipientUserIds =
            await getRecipientUserIds(
              prisma,
              conversationId,
              req.userId
            );

          await redis.publishChatEvent({
            recipientUserIds,

            event: {
              type:
                "message_deleted",

              data: {
                message:
                  deletedForDelivery,
              },
            },
          });

          res.json(
            deletedForDelivery
          );
        } catch (error) {
          console.error(
            "Failed to delete message:",
            error
          );

          res.status(500).json({
            error:
              "Failed to delete message",
          });
        }
      }
    );

    router.post(
      "/:conversationId/messages/:messageId/reactions",
      async (req, res) => {
        try {
          const conversationId = Number(req.params.conversationId);
          const messageId = Number(req.params.messageId);
          const result = reactionSchema.safeParse(req.body);

          if (!Number.isInteger(conversationId) || !Number.isInteger(messageId) || !result.success) {
            return res.status(400).json({ error: "Invalid reaction request" });
          }

          const membership = await prisma.conversationMember.findUnique({
            where: { userId_conversationId: { userId: req.userId, conversationId } },
          });
          const message = await prisma.message.findFirst({ where: { id: messageId, conversationId } });

          if (!membership) return res.status(403).json({ error: "You are not a member of this conversation" });
          if (!message || message.deletedAt) return res.status(404).json({ error: "Message not found" });

          const where = { messageId_userId_emoji: { messageId, userId: req.userId, emoji: result.data.emoji } };
          const existing = await prisma.messageReaction.findUnique({ where });

          if (existing) {
            await prisma.messageReaction.delete({ where });
          } else {
            await prisma.messageReaction.create({ data: { messageId, userId: req.userId, emoji: result.data.emoji } });
          }

          const updatedMessage = await prisma.message.findUnique({ where: { id: messageId }, include: messageInclude });
          const updatedForDelivery = storage.configured ? await withAttachmentUrls(updatedMessage, storage) : updatedMessage;
          const recipientUserIds = await getRecipientUserIds(prisma, conversationId, req.userId);
          await redis.publishChatEvent({
            recipientUserIds,
            event: { type: "message_updated", data: { message: updatedForDelivery } },
          });
          res.json(updatedForDelivery);
        } catch (error) {
          console.error("Failed to toggle reaction:", error);
          res.status(500).json({ error: "Failed to toggle reaction" });
        }
      }
    );

    router.get("/:conversationId/pins", async (req, res) => {
      try {
        const conversationId = Number(req.params.conversationId);
        if (!Number.isInteger(conversationId)) return res.status(400).json({ error: "Invalid conversation ID" });
        const membership = await prisma.conversationMember.findUnique({
          where: { userId_conversationId: { userId: req.userId, conversationId } },
        });
        if (!membership) return res.status(403).json({ error: "You are not a member of this conversation" });
        const pins = await prisma.messagePin.findMany({
          where: { message: { conversationId, deletedAt: null } },
          include: { pinnedBy: { select: { id: true, name: true } }, message: { include: messageInclude } },
          orderBy: { createdAt: "desc" },
        });
        res.json({ pins: storage.configured ? await Promise.all(pins.map(async (pin) => ({ ...pin, message: await withAttachmentUrls(pin.message, storage) }))) : pins });
      } catch (error) {
        console.error("Failed to get pinned messages:", error);
        res.status(500).json({ error: "Failed to get pinned messages" });
      }
    });

    router.post("/:conversationId/messages/:messageId/pin", async (req, res) => {
      try {
        const conversationId = Number(req.params.conversationId);
        const messageId = Number(req.params.messageId);
        const membership = await prisma.conversationMember.findUnique({
          where: { userId_conversationId: { userId: req.userId, conversationId } },
        });
        const message = await prisma.message.findFirst({ where: { id: messageId, conversationId } });
        if (!membership) return res.status(403).json({ error: "You are not a member of this conversation" });
        if (!message || message.deletedAt) return res.status(404).json({ error: "Message not found" });
        const existing = await prisma.messagePin.findUnique({ where: { messageId } });
        if (existing) await prisma.messagePin.delete({ where: { messageId } });
        else await prisma.messagePin.create({ data: { messageId, pinnedById: req.userId } });
        const updatedMessage = await prisma.message.findUnique({ where: { id: messageId }, include: messageInclude });
        const updatedForDelivery = storage.configured ? await withAttachmentUrls(updatedMessage, storage) : updatedMessage;
        const recipientUserIds = await getRecipientUserIds(prisma, conversationId, req.userId);
        await redis.publishChatEvent({ recipientUserIds, event: { type: "message_updated", data: { message: updatedForDelivery } } });
        res.json(updatedForDelivery);
      } catch (error) {
        console.error("Failed to toggle message pin:", error);
        res.status(500).json({ error: "Failed to update pin" });
      }
    });

    return router;
  };
