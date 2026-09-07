require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const {
  PrismaClient,
} = require("@prisma/client");

const createAuthRoutes =
  require("./routes/auth");

const createConversationRoutes =
  require("./routes/conversations");

const createMessageRoutes =
  require("./routes/messages");

const createMemberRoutes =
  require("./routes/members");

const createUserRoutes =
  require("./routes/users");
const createFriendRoutes =
  require("./routes/friends");
const createSearchRoutes =
  require("./routes/search");
const createNotificationRoutes =
  require("./routes/notifications");
const createAttachmentRoutes = require("./routes/attachments");
const { createStorage } = require("./storage");

const requireAuth =
  require("./middleware/auth");

const createWebSocketServer =
  require("./websocket");

const createRedis =
  require("./redis");

const app = express();
const prisma = new PrismaClient();
const storage = createStorage();

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0";
const allowedOrigins = (process.env.CLIENT_ORIGINS || "http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set("trust proxy", 1);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed"));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
  });
});

app.use(
  "/auth",
  createAuthRoutes(prisma)
);

app.use(
  "/users",
  requireAuth,
  createUserRoutes(prisma)
);

app.use(
  "/search",
  requireAuth,
  createSearchRoutes(prisma)
);

app.use(
  "/notifications",
  requireAuth,
  createNotificationRoutes(prisma)
);

async function startServer() {
  try {
    const redis =
      await createRedis();

    const server =
      http.createServer(app);

    const websocket =
      createWebSocketServer(
        server,
        prisma,
        redis
      );

    app.use(
      "/friends",
      requireAuth,
      createFriendRoutes(prisma, redis)
    );

    await redis.subscribeToChatEvents(
      (redisEvent) => {
        const {
          recipientUserIds,
          event,
        } = redisEvent;

        if (
          !Array.isArray(
            recipientUserIds
          )
        ) {
          console.error(
            "Redis event missing recipientUserIds:",
            redisEvent
          );

          return;
        }

        if (!event) {
          console.error(
            "Redis event missing event:",
            redisEvent
          );

          return;
        }

        websocket.sendToUsers(
          recipientUserIds,
          event
        );
      }
    );

    app.use(
      "/conversations",
      requireAuth,
      createConversationRoutes(prisma, redis, storage)
    );

    app.use(
      "/conversations",
      requireAuth,
      createMemberRoutes(
        prisma,
        redis
      )
    );

    app.use(
      "/conversations",
      requireAuth,
      createMessageRoutes(
        prisma,
        redis,
        storage
      )
    );

    app.use("/attachments", requireAuth, createAttachmentRoutes(prisma, storage));

    server.listen(PORT, HOST, () => {
      console.log(
        `Server running on ${HOST}:${PORT}`
      );
    });

    const shutdown = (signal) => {
      console.log(`${signal} received; closing server`);
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });

      setTimeout(() => process.exit(1), 10000).unref();
    };

    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error(
      "Failed to start server:",
      error
    );

    process.exit(1);
  }
}

startServer();
