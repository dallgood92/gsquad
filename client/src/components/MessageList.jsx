import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const LOAD_MORE_THRESHOLD = 100;

const NEAR_BOTTOM_THRESHOLD =
  100;

function formatMessageTime(
  createdAt
) {
  if (!createdAt) {
    return "";
  }

  const date =
    new Date(createdAt);

  return new Intl.DateTimeFormat(
    undefined,
    {
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
}

function MessageList({
  messages,
  currentUser,
  hasMoreMessages,
  onLoadOlderMessages,
  olderMessagesLoading,
}) {
  const listRef =
    useRef(null);

  const previousMessagesRef =
    useRef([]);

  const previousScrollHeightRef =
    useRef(null);

  const loadingOlderRef =
    useRef(false);

  const isNearBottomRef =
    useRef(true);

  const [
    hasNewMessages,
    setHasNewMessages,
  ] = useState(false);

  const isNearBottom = () => {
    const list =
      listRef.current;

    if (!list) {
      return true;
    }

    const distanceFromBottom =
      list.scrollHeight -
      list.scrollTop -
      list.clientHeight;

    return (
      distanceFromBottom <=
      NEAR_BOTTOM_THRESHOLD
    );
  };

  const scrollToBottom = () => {
    const list =
      listRef.current;

    if (!list) {
      return;
    }

    list.scrollTop =
      list.scrollHeight;

    isNearBottomRef.current =
      true;

    setHasNewMessages(false);
  };

  const handleLoadOlder =
    async () => {
      const list =
        listRef.current;

      if (!list) {
        return;
      }

      if (!hasMoreMessages) {
        return;
      }

      if (
        olderMessagesLoading
      ) {
        return;
      }

      if (
        loadingOlderRef.current
      ) {
        return;
      }

      loadingOlderRef.current =
        true;

      previousScrollHeightRef.current =
        list.scrollHeight;

      try {
        const loaded =
          await onLoadOlderMessages();

        if (!loaded) {
          previousScrollHeightRef.current =
            null;
        }
      } finally {
        loadingOlderRef.current =
          false;
      }
    };

  const handleScroll = () => {
    const list =
      listRef.current;

    if (!list) {
      return;
    }

    isNearBottomRef.current =
      isNearBottom();

    if (
      isNearBottomRef.current
    ) {
      setHasNewMessages(
        false
      );
    }

    if (
      list.scrollTop <=
      LOAD_MORE_THRESHOLD
    ) {
      handleLoadOlder();
    }
  };

  useLayoutEffect(() => {
    const list =
      listRef.current;

    if (!list) {
      return;
    }

    if (
      previousScrollHeightRef.current !==
      null
    ) {
      const previousScrollHeight =
        previousScrollHeightRef.current;

      const newScrollHeight =
        list.scrollHeight;

      const addedHeight =
        newScrollHeight -
        previousScrollHeight;

      list.scrollTop +=
        addedHeight;

      previousScrollHeightRef.current =
        null;

      return;
    }

    const previousMessages =
      previousMessagesRef.current;

    const previousLastMessage =
      previousMessages[
        previousMessages.length -
          1
      ];

    const currentLastMessage =
      messages[
        messages.length - 1
      ];

    const newMessageWasAppended =
      currentLastMessage &&
      currentLastMessage.id !==
        previousLastMessage?.id;

    if (!newMessageWasAppended) {
      return;
    }

    const isOwnMessage =
      currentLastMessage.senderId ===
      currentUser.id;

    if (
      isOwnMessage ||
      isNearBottomRef.current
    ) {
      scrollToBottom();
      return;
    }

    setHasNewMessages(true);
  }, [
    messages,
    currentUser.id,
  ]);

  useEffect(() => {
    previousMessagesRef.current =
      messages;
  }, [messages]);

  return (
    <div className="message-list-container">
      <div
        ref={listRef}
        className="message-list"
        onScroll={handleScroll}
      >
        {olderMessagesLoading && (
          <p className="older-messages-loading">
            Loading older messages...
          </p>
        )}

        {messages.map(
          (message) => {
            const isOwnMessage =
              message.senderId ===
              currentUser.id;

            return (
              <div
                key={message.id}
                className={`message ${
                  isOwnMessage
                    ? "message-own"
                    : "message-other"
                }`}
              >
                <span className="message-sender">
                  {
                    message.sender
                      .name
                  }
                </span>

                <span className="message-text">
                  {message.text}
                </span>

                <span className="message-time">
                  {formatMessageTime(
                    message.createdAt
                  )}
                </span>
              </div>
            );
          }
        )}
      </div>

      {hasNewMessages && (
        <button
          type="button"
          className="new-messages-button"
          onClick={
            scrollToBottom
          }
        >
          New messages ↓
        </button>
      )}
    </div>
  );
}

export default MessageList;