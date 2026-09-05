const { createClient } = require("redis");

const CHAT_EVENTS_CHANNEL = "chat-events";
const PRESENCE_KEY = "online-users";

async function createRedis() {
  const publisher = createClient({
    url: process.env.REDIS_URL,
  });

  const subscriber = publisher.duplicate();

  publisher.on("error", (error) => {
    console.error(
      "Redis publisher error:",
      error
    );
  });

  subscriber.on("error", (error) => {
    console.error(
      "Redis subscriber error:",
      error
    );
  });

  await publisher.connect();
  await subscriber.connect();

  console.log("Redis connected");

  async function publishChatEvent(event) {
    await publisher.publish(
      CHAT_EVENTS_CHANNEL,
      JSON.stringify(event)
    );
  }

  async function subscribeToChatEvents(onEvent) {
    await subscriber.subscribe(
      CHAT_EVENTS_CHANNEL,
      (message) => {
        try {
          const event = JSON.parse(message);

          onEvent(event);
        } catch (error) {
          console.error(
            "Failed to parse Redis event:",
            error
          );
        }
      }
    );

    console.log(
      `Subscribed to Redis channel: ${CHAT_EVENTS_CHANNEL}`
    );
  }

  async function addUserConnection(userId) {
    const connectionCount =
      await publisher.hIncrBy(
        PRESENCE_KEY,
        String(userId),
        1
      );

    return connectionCount;
  }

  async function removeUserConnection(userId) {
    const userKey = String(userId);

    const currentCount =
      await publisher.hGet(
        PRESENCE_KEY,
        userKey
      );

    if (!currentCount) {
      return 0;
    }

    const connectionCount =
      await publisher.hIncrBy(
        PRESENCE_KEY,
        userKey,
        -1
      );

    if (connectionCount <= 0) {
      await publisher.hDel(
        PRESENCE_KEY,
        userKey
      );

      return 0;
    }

    return connectionCount;
  }

  async function getOnlineUserIds() {
    const presence =
      await publisher.hGetAll(
        PRESENCE_KEY
      );

    return Object.entries(presence)
      .filter(
        ([, connectionCount]) =>
          Number(connectionCount) > 0
      )
      .map(([userId]) =>
        Number(userId)
      );
  }

  return {
    publishChatEvent,
    subscribeToChatEvents,
    addUserConnection,
    removeUserConnection,
    getOnlineUserIds,
  };
}

module.exports = createRedis;