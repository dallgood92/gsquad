import { useEffect, useState } from "react";
import { getMessageThread } from "../services/api";
import MessageInput from "./MessageInput";

function ThreadMessage({ message }) {
  return <div className="thread-message"><strong>{message.sender.name}</strong><span>{message.deletedAt ? "Message deleted" : message.text}</span></div>;
}

function ThreadPanel({ conversationId, rootMessage, liveMessages, onClose, onSendMessage }) {
  const [thread, setThread] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    getMessageThread(conversationId, rootMessage.id)
      .then((data) => active && setThread(data))
      .catch((requestError) => active && setError(requestError.message));
    return () => { active = false; };
  }, [conversationId, rootMessage.id]);

  const repliesById = new Map((thread?.replies ?? []).map((reply) => [reply.id, reply]));
  for (const message of liveMessages) {
    if (message.replyToMessageId === rootMessage.id) repliesById.set(message.id, message);
  }
  const replies = [...repliesById.values()].sort((a, b) => a.id - b.id);

  const sendReply = async (text) => {
    const reply = await onSendMessage(text, rootMessage.id);
    if (reply) setThread((current) => ({ ...(current ?? rootMessage), replies: [...(current?.replies ?? []), reply] }));
  };

  return (
    <aside className="thread-panel">
      <header><h3>Thread</h3><button type="button" onClick={onClose} aria-label="Close thread">×</button></header>
      <div className="thread-content">
        <ThreadMessage message={thread ?? rootMessage} />
        <div className="thread-divider">{replies.length} {replies.length === 1 ? "reply" : "replies"}</div>
        {error && <p>{error}</p>}
        {replies.map((reply) => <ThreadMessage key={reply.id} message={reply} />)}
      </div>
      <MessageInput onSendMessage={sendReply} />
    </aside>
  );
}

export default ThreadPanel;
