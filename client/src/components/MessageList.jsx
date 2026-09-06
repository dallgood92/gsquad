import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const LOAD_MORE_THRESHOLD = 100;
const NEAR_BOTTOM_THRESHOLD = 100;

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
  onEditMessage,
  onDeleteMessage,
  onToggleReaction,
  onReply,
  onTogglePin,
  onRetryMessage,
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

  const [
    editingMessageId,
    setEditingMessageId,
  ] = useState(null);

  const [
    editingText,
    setEditingText,
  ] = useState("");

  const [
    savingMessageId,
    setSavingMessageId,
  ] = useState(null);

  const [
    deletingMessageId,
    setDeletingMessageId,
  ] = useState(null);

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

  const startEditing = (
    message
  ) => {
    setEditingMessageId(
      message.id
    );

    setEditingText(
      message.text
    );
  };

  const cancelEditing = () => {
    setEditingMessageId(
      null
    );

    setEditingText("");
  };

  const saveEditing =
    async (messageId) => {
      const trimmedText =
        editingText.trim();

      if (!trimmedText) {
        return;
      }

      try {
        setSavingMessageId(
          messageId
        );

        const saved =
          await onEditMessage(
            messageId,
            trimmedText
          );

        if (saved) {
          cancelEditing();
        }
      } finally {
        setSavingMessageId(
          null
        );
      }
    };

  const handleDelete =
    async (messageId) => {
      const shouldDelete =
        window.confirm(
          "Delete this message?"
        );

      if (!shouldDelete) {
        return;
      }

      try {
        setDeletingMessageId(
          messageId
        );

        await onDeleteMessage(
          messageId
        );

        if (
          editingMessageId ===
          messageId
        ) {
          cancelEditing();
        }
      } finally {
        setDeletingMessageId(
          null
        );
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

    if (
      !newMessageWasAppended
    ) {
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

  useEffect(() => {
    if (!editingMessageId) {
      return;
    }

    const editingMessage =
      messages.find(
        (message) =>
          message.id ===
          editingMessageId
      );

    if (
      !editingMessage ||
      editingMessage.deletedAt
    ) {
      cancelEditing();
    }
  }, [
    messages,
    editingMessageId,
  ]);

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

        {messages.filter((message) => !message.replyToMessageId).map(
          (message) => {
            const isOwnMessage =
              message.senderId ===
              currentUser.id;

            const isDeleted =
              Boolean(
                message.deletedAt
              );

            const isEditing =
              editingMessageId ===
              message.id;

            const isSaving =
              savingMessageId ===
              message.id;

            const isDeleting =
              deletingMessageId ===
              message.id;

            const reactions = Object.values(
              (message.reactions ?? []).reduce((groups, reaction) => {
                groups[reaction.emoji] ??= { emoji: reaction.emoji, users: [] };
                groups[reaction.emoji].users.push(reaction.user);
                return groups;
              }, {})
            );

            return (
              <div
                key={message.id}
                className={`message ${
                  isOwnMessage
                    ? "message-own"
                    : "message-other"
                } ${
                  isDeleted
                    ? "message-deleted"
                    : ""
                }`}
              >
                <span className="message-sender">
                  {
                    message.sender
                      .name
                  }
                </span>

                {message.replyToMessage && (
                  <div className="reply-preview">
                    <strong>{message.replyToMessage.sender.name}</strong>
                    <span>{message.replyToMessage.deletedAt ? "Message deleted" : message.replyToMessage.text}</span>
                  </div>
                )}

                {isDeleted ? (
                  <span className="message-text message-deleted-text">
                    Message deleted
                  </span>
                ) : isEditing ? (
                  <div className="message-edit-form">
                    <input
                      type="text"
                      value={
                        editingText
                      }
                      onChange={(
                        event
                      ) =>
                        setEditingText(
                          event.target
                            .value
                        )
                      }
                      onKeyDown={(
                        event
                      ) => {
                        if (
                          event.key ===
                          "Enter"
                        ) {
                          event.preventDefault();

                          saveEditing(
                            message.id
                          );
                        }

                        if (
                          event.key ===
                          "Escape"
                        ) {
                          cancelEditing();
                        }
                      }}
                      maxLength={2000}
                      autoFocus
                    />

                    <div className="message-edit-actions">
                      <button
                        type="button"
                        onClick={() =>
                          saveEditing(
                            message.id
                          )
                        }
                        disabled={
                          isSaving ||
                          !editingText.trim()
                        }
                      >
                        {isSaving
                          ? "Saving..."
                          : "Save"}
                      </button>

                      <button
                        type="button"
                        onClick={
                          cancelEditing
                        }
                        disabled={
                          isSaving
                        }
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <span className="message-text">
                    {message.text}
                  </span>
                )}

                <div className="message-meta">
                  <span className="message-time">
                    {formatMessageTime(
                      message.createdAt
                    )}
                  </span>

                  {!isDeleted &&
                    message.editedAt && (
                      <span className="message-edited">
                        (edited)
                      </span>
                    )}
                  {message.deliveryStatus && (
                    <span className={`message-delivery ${message.deliveryStatus}`}>
                      {message.deliveryStatus === "sending" ? "Sending…" : "Failed"}
                    </span>
                  )}
                </div>

                {message.deliveryStatus === "failed" && (
                  <button type="button" className="retry-message" onClick={() => onRetryMessage(message.id)}>Retry</button>
                )}

                {!isDeleted && (
                  <div className="message-reactions">
                    {reactions.map((reaction) => (
                      <button
                        type="button"
                        key={reaction.emoji}
                        className={reaction.users.some((user) => user.id === currentUser.id) ? "active" : ""}
                        title={reaction.users.map((user) => user.name).join(", ")}
                        onClick={() => onToggleReaction(message.id, reaction.emoji)}
                      >
                        {reaction.emoji} {reaction.users.length}
                      </button>
                    ))}
                    {["👍", "❤️", "😂"].filter((emoji) => !reactions.some((reaction) => reaction.emoji === emoji)).map((emoji) => (
                      <button type="button" className="reaction-add" key={emoji} onClick={() => onToggleReaction(message.id, emoji)}>{emoji}</button>
                    ))}
                  </div>
                )}

                {isOwnMessage && !message.isOptimistic &&
                  !isDeleted &&
                  !isEditing && (
                    <div className="message-actions">
                      <button
                        type="button"
                        onClick={() =>
                          startEditing(
                            message
                          )
                        }
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(
                            message.id
                          )
                        }
                        disabled={
                          isDeleting
                        }
                      >
                        {isDeleting
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>
                  )}
                {!isDeleted && !isEditing && !message.isOptimistic && (
                  <button type="button" className="reply-button" onClick={() => onReply(message)}>
                    {messages.filter((candidate) => candidate.replyToMessageId === message.id).length
                      ? `View thread (${messages.filter((candidate) => candidate.replyToMessageId === message.id).length})`
                      : "Reply"}
                  </button>
                )}
                {!isDeleted && !isEditing && !message.isOptimistic && (
                  <button type="button" className="pin-button" onClick={() => onTogglePin(message.id)}>
                    {message.pins?.length ? "Unpin" : "Pin"}
                  </button>
                )}
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
