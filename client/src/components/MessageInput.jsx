import {
  useEffect,
  useRef,
  useState,
} from "react";

function MessageInput({
  onSendMessage,
  onTypingStart,
  onTypingStop,
  replyToMessage,
  onCancelReply,
  draftKey,
}) {
  const storageKey = `message-draft:${draftKey}`;
  const [message, setMessage] = useState(() => localStorage.getItem(storageKey) ?? "");
  const [sending, setSending] = useState(false);

  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const stopTyping = () => {
    if (!isTypingRef.current) {
      return;
    }

    isTypingRef.current = false;

    onTypingStop?.();
  };

  const handleChange = (event) => {
    const value = event.target.value;

    setMessage(value);
    if (value) localStorage.setItem(storageKey, value);
    else localStorage.removeItem(storageKey);

    if (!value.trim()) {
      clearTimeout(typingTimeoutRef.current);
      stopTyping();
      return;
    }

    if (!isTypingRef.current) {
      isTypingRef.current = true;

      onTypingStart?.();
    }

    clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1500);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!message.trim()) {
      return;
    }

    clearTimeout(typingTimeoutRef.current);
    stopTyping();

    try {
      setSending(true);
      const sentMessage = await onSendMessage(message, replyToMessage?.id ?? null);
      if (sentMessage) {
        setMessage("");
        localStorage.removeItem(storageKey);
        onCancelReply?.();
      }
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  return (
    <div className="message-composer">
      {replyToMessage && (
        <div className="reply-composer-preview">
          <span>
            Replying to {replyToMessage.sender.name}: {replyToMessage.text}
          </span>
          <button type="button" onClick={onCancelReply} aria-label="Cancel reply">×</button>
        </div>
      )}
    <form
      className="message-input"
      onSubmit={handleSubmit}
    >
      <textarea
        value={message}
        onChange={handleChange}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form.requestSubmit();
          }
        }}
        placeholder="Type a message..."
        maxLength={2000}
        rows={1}
        disabled={sending}
      />

      <span className="draft-status">{message ? `Draft · ${message.length}/2000` : ""}</span>

      <button type="submit" disabled={sending || !message.trim()}>
        {sending ? "Sending..." : "Send"}
      </button>
    </form>
    </div>
  );
}

export default MessageInput;
