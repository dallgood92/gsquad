const jwt = require("jsonwebtoken");

const {
  WebSocketServer,
  WebSocket,
} = require("ws");

const HEARTBEAT_INTERVAL_MS = 30000;

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const separatorIndex =
          cookie.indexOf("=");

        const key = cookie.slice(
          0,
          separatorIndex
        );

        const value = cookie.slice(
          separatorIndex + 1
        );

        return [
          key,
          decodeURIComponent(value),
        ];
      })
  );
}

function createWebSocketServer(
  server,
  prisma,
  redis
) {
  const wss = new WebSocketServer({
    server,
  });

  const heartbeatInterval = setInterval(() => {
    for (const client of wss.clients) {
      if (client.isAlive === false) {
        client.terminate();
        continue;
      }

      client.isAlive = false;
      client.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  heartbeatInterval.unref();
  wss.on("close", () => clearInterval(heartbeatInterval));

  function sendToUsers(userIds, event) {
    const message =
      JSON.stringify(event);

    for (const client of wss.clients) {
      if (
        client.readyState ===
          WebSocket.OPEN &&
        userIds.includes(client.userId)
      ) {
        client.send(message);
      }
    }
  }

  async function publishPresenceEvent(
    type,
    userId
  ) {
    const onlineUserIds =
      await redis.getOnlineUserIds();

    await redis.publishChatEvent({
      recipientUserIds: onlineUserIds,

      event: {
        type,

        data: {
          userId,
        },
      },
    });
  }

  async function handleTypingEvent(
    socket,
    event
  ) {
    const conversationId = Number(
      event.data?.conversationId
    );

    if (
      !Number.isInteger(
        conversationId
      )
    ) {
      return;
    }

    const membership =
      await prisma.conversationMember.findUnique(
        {
          where: {
            userId_conversationId: {
              userId: socket.userId,
              conversationId,
            },
          },
        }
      );

    if (!membership) {
      return;
    }

    const members =
      await prisma.conversationMember.findMany(
        {
          where: {
            conversationId,
          },

          select: {
            userId: true,
          },
        }
      );

    const recipientUserIds = members
      .map(
        (member) => member.userId
      )
      .filter(
        (userId) =>
          userId !== socket.userId
      );

    await redis.publishChatEvent({
      recipientUserIds,

      event: {
        type: event.type,

        data: {
          conversationId,
          userId: socket.userId,
        },
      },
    });
  }

  wss.on(
    "connection",
    async (socket, request) => {
      try {
        socket.isAlive = true;
        socket.on("pong", () => {
          socket.isAlive = true;
        });

        const cookies = parseCookies(
          request.headers.cookie
        );

        const token =
          cookies.session;

        if (!token) {
          socket.close(
            1008,
            "Authentication required"
          );

          return;
        }

        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET
        );

        socket.userId =
          decoded.userId;

        const connectionCount =
          await redis.addUserConnection(
            socket.userId
          );

        const onlineUserIds =
          await redis.getOnlineUserIds();

        console.log(
          `WebSocket connected: user ${socket.userId}`
        );

        console.log(
          `User ${socket.userId} has ${connectionCount} active connection(s)`
        );

        socket.send(
          JSON.stringify({
            type: "connection_ready",

            data: {
              userId:
                socket.userId,

              onlineUserIds,
            },
          })
        );

        if (connectionCount === 1) {
          await publishPresenceEvent(
            "user_online",
            socket.userId
          );
        }

        socket.on(
          "message",
          async (rawMessage) => {
            try {
              const event =
                JSON.parse(
                  rawMessage.toString()
                );

              switch (event.type) {
                case "typing_started":
                case "typing_stopped":
                  await handleTypingEvent(
                    socket,
                    event
                  );

                  break;

                default:
                  console.log(
                    "Unhandled WebSocket event:",
                    event.type
                  );
              }
            } catch (error) {
              console.error(
                "Failed to handle WebSocket message:",
                error
              );
            }
          }
        );

        socket.on(
          "close",
          async () => {
            try {
              console.log(
                `WebSocket disconnected: user ${socket.userId}`
              );

              const remainingConnections =
                await redis.removeUserConnection(
                  socket.userId
                );

              console.log(
                `User ${socket.userId} has ${remainingConnections} active connection(s)`
              );

              if (
                remainingConnections === 0
              ) {
                await publishPresenceEvent(
                  "user_offline",
                  socket.userId
                );
              }
            } catch (error) {
              console.error(
                "Failed to update presence:",
                error
              );
            }
          }
        );
      } catch (error) {
        console.error(
          "WebSocket authentication failed:",
          error.message
        );

        socket.close(
          1008,
          "Invalid session"
        );
      }
    }
  );

  return {
    sendToUsers,
  };
}

module.exports =
  createWebSocketServer;
