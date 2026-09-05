import {
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

const LOAD_MORE_THRESHOLD = 100;

function MessageList({
  messages,
  currentUser,
  hasMoreMessages,
  onLoadOlderMessages,
  olderMessagesLoading,
}) {
  const listRef = useRef(null);

  const previousMessagesRef =
    useRef([]);

  const previousScrollHeightRef =
    useRef(null);

  const handleLoadOlder = async () => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    if (!hasMoreMessages) {
      return;
    }

    if (olderMessagesLoading) {
      return;
    }

    previousScrollHeightRef.current =
      list.scrollHeight;

    await onLoadOlderMessages();
  };

  const handleScroll = () => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    if (
      list.scrollTop <=
      LOAD_MORE_THRESHOLD
    ) {
      handleLoadOlder();
    }
  };

  useLayoutEffect(() => {
    const list = listRef.current;

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

      list.scrollTop += addedHeight;

      previousScrollHeightRef.current =
        null;

      return;
    }

    const previousMessages =
      previousMessagesRef.current;

    const previousLastMessage =
      previousMessages[
        previousMessages.length - 1
      ];

    const currentLastMessage =
      messages[
        messages.length - 1
      ];

    const newMessageWasAppended =
      currentLastMessage &&
      currentLastMessage.id !==
        previousLastMessage?.id;

    if (newMessageWasAppended) {
      list.scrollTop =
        list.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    previousMessagesRef.current =
      messages;
  }, [messages]);

  return (
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

      {messages.map((message) => {
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
              {message.sender.name}
            </span>

            <span className="message-text">
              {message.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default MessageList;