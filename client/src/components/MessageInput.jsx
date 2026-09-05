import {
  useEffect,
  useRef,
  useState,
} from "react";

function MessageInput({
  onSendMessage,
  onTypingStart,
  onTypingStop,
}) {
  const [message, setMessage] = useState("");

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

    await onSendMessage(message);

    setMessage("");
  };

  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  return (
    <form
      className="message-input"
      onSubmit={handleSubmit}
    >
      <input
        type="text"
        value={message}
        onChange={handleChange}
        placeholder="Type a message..."
      />

      <button type="submit">
        Send
      </button>
    </form>
  );
}

export default MessageInput;