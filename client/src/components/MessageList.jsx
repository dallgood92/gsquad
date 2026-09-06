import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Avatar from "./Avatar";

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
  members,
  showSenderNames,
  hasMoreMessages,
  onLoadOlderMessages,
  olderMessagesLoading,
  onEditMessage,
  onDeleteMessage,
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

  const [openMenuId, setOpenMenuId] = useState(null);
  const [confirmDeleteMessageId, setConfirmDeleteMessageId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

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
      try {
        setDeleteError("");
        setDeletingMessageId(
          messageId
        );

        const deleted = await onDeleteMessage(
          messageId
        );

        if (!deleted) {
          setDeleteError("The message could not be deleted. Please try again.");
          return;
        }

        setConfirmDeleteMessageId(null);

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
    if (!openMenuId) return undefined;
    const closeMenu = (event) => {
      if (!event.target.closest(".message-menu")) setOpenMenuId(null);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [openMenuId]);

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

  const rootMessages = messages.filter((message) => !message.replyToMessageId && !message.deletedAt);

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

        {rootMessages.map(
          (message, messageIndex) => {
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

            const readers = isOwnMessage
              ? members.filter((membership) =>
                  membership.userId !== currentUser.id &&
                  (membership.lastReadMessageId ?? 0) >= message.id
                )
              : [];
            const previousMessage = rootMessages[messageIndex - 1];
            const nextMessage = rootMessages[messageIndex + 1];
            const startsGroup = previousMessage?.senderId !== message.senderId;
            const endsGroup = nextMessage?.senderId !== message.senderId;

            return (
              <div
                key={message.id}
                className={`message-row ${
                  isOwnMessage
                    ? "message-row-own"
                    : "message-row-other"
                } ${
                  isDeleted
                    ? "message-deleted"
                    : ""
                } ${
                  startsGroup
                    ? "message-group-start"
                    : ""
                } ${
                  endsGroup
                    ? "message-group-end"
                    : ""
                }`}
              >
                {showSenderNames && !isOwnMessage && startsGroup && (
                  <span className="message-sender">
                    {
                      message.sender
                        .name
                    }
                  </span>
                )}

                <div className="message-line">
                {!isOwnMessage && (
                  <span className="message-avatar-slot">
                    {endsGroup && <Avatar user={message.sender} size="small" />}
                  </span>
                )}
                <div className={`message ${isOwnMessage ? "message-own" : "message-other"}`}>

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
                ) : message.text ? (
                  <span className="message-text">
                    {message.text}
                  </span>
                ) : null}

                {!isDeleted && message.attachments?.map((attachment) => attachment.mimeType.startsWith("video/") ? (
                  <video className="message-attachment message-video" key={attachment.id ?? attachment.storageKey} src={attachment.url} controls playsInline preload="metadata" />
                ) : (
                  <a className="message-attachment-link" key={attachment.id ?? attachment.storageKey} href={attachment.url} target="_blank" rel="noreferrer">
                    <img className="message-attachment message-image" src={attachment.url} alt={attachment.originalName} loading="lazy" />
                  </a>
                ))}

                {message.deliveryStatus === "failed" && (
                  <button type="button" className="retry-message" onClick={() => onRetryMessage(message.id)}>Retry</button>
                )}

                {!isDeleted && !isEditing && !message.isOptimistic && (
                  <div className="message-menu">
                    <button
                      type="button"
                      className="message-menu-trigger"
                      aria-label="Message actions"
                      aria-expanded={openMenuId === message.id}
                      onClick={() => setOpenMenuId((current) => current === message.id ? null : message.id)}
                    ><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg></button>
                    {openMenuId === message.id && (
                      <div className="message-menu-popover">
                        <button type="button" onClick={() => { onReply(message); setOpenMenuId(null); }}>
                          {messages.some((candidate) => candidate.replyToMessageId === message.id) ? "View thread" : "Reply"}
                        </button>
                        <button type="button" onClick={() => { onTogglePin(message.id); setOpenMenuId(null); }}>{message.pins?.length ? "Unpin message" : "Pin message"}</button>
                        {isOwnMessage && message.text && <button type="button" onClick={() => { startEditing(message); setOpenMenuId(null); }}>Edit message</button>}
                        {isOwnMessage && <button type="button" className="danger-action" disabled={isDeleting} onClick={() => { setDeleteError(""); setConfirmDeleteMessageId(message.id); setOpenMenuId(null); }}>Delete message</button>}
                      </div>
                    )}
                  </div>
                )}
                </div>
                </div>

                {confirmDeleteMessageId === message.id && (
                  <div className="message-delete-confirm" role="dialog" aria-label="Confirm message deletion">
                    <span>{deleteError || "Delete this message?"}</span>
                    <div>
                      <button type="button" disabled={isDeleting} onClick={() => { setConfirmDeleteMessageId(null); setDeleteError(""); }}>Cancel</button>
                      <button type="button" className="danger-action" disabled={isDeleting} onClick={() => handleDelete(message.id)}>{isDeleting ? "Deleting…" : "Delete"}</button>
                    </div>
                  </div>
                )}

                <div className={`message-meta ${endsGroup ? "message-meta-visible" : ""}`}>
                  <span className="message-time">
                    {formatMessageTime(message.createdAt)}{readers.length > 0 ? " · Read" : ""}
                  </span>
                  {!isDeleted && message.editedAt && (
                    <span className="message-edited">Edited</span>
                  )}
                  {message.deliveryStatus && (
                    <span className={`message-delivery ${message.deliveryStatus}`}>
                      {message.deliveryStatus === "sending" ? "Sending…" : "Failed"}
                    </span>
                  )}
                </div>
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
