import {
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

function MessageList({
  messages,
  currentUser,
  hasMoreMessages,
  onLoadOlderMessages,
  olderMessagesLoading,
}) {
  const listRef = useRef(null);
  const previousMessagesRef = useRef([]);
  const previousScrollHeightRef =
    useRef(null);

  const handleLoadOlder = async () => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    previousScrollHeightRef.current =
      list.scrollHeight;

    await onLoadOlderMessages();
  };

  useLayoutEffect(() => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    if (
      previousScrollHeightRef.current !== null
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
      messages[messages.length - 1];

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
    >
      {hasMoreMessages && (
        <button
          type="button"
          className="load-older-button"
          onClick={handleLoadOlder}
          disabled={olderMessagesLoading}
        >
          {olderMessagesLoading
            ? "Loading..."
            : "Load older messages"}
        </button>
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