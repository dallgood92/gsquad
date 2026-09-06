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
const createSearchRoutes =
  require("./routes/search");
const createNotificationRoutes =
  require("./routes/notifications");

const requireAuth =
  require("./middleware/auth");

const createWebSocketServer =
  require("./websocket");

const createRedis =
  require("./redis");

const app = express();
const prisma = new PrismaClient();

const PORT = 3001;

app.use(
  cors({
    origin: "http://localhost:5174",
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
      createConversationRoutes(prisma, redis)
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
        redis
      )
    );

    server.listen(PORT, () => {
      console.log(
        `Server running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Failed to start server:",
      error
    );

    process.exit(1);
  }
}

startServer();
