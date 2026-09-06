import { useRef, useEffect, useState } from "react";
import { getMessageThread } from "../services/api";
import MessageInput from "./MessageInput";
import useClickOutside from "../hooks/useClickOutside";

function ThreadMessage({ message }) {
  return <div className="thread-message"><strong>{message.sender.name}</strong>{message.text && <span>{message.deletedAt ? "Message deleted" : message.text}</span>}{!message.deletedAt && message.attachments?.map((attachment) => attachment.mimeType.startsWith("video/") ? <video className="thread-attachment" key={attachment.id ?? attachment.storageKey} src={attachment.url} controls preload="metadata" /> : <img className="thread-attachment" key={attachment.id ?? attachment.storageKey} src={attachment.url} alt={attachment.originalName} loading="lazy" />)}</div>;
}

function ThreadPanel({ conversationId, rootMessage, liveMessages, onClose, onSendMessage }) {
  const [thread, setThread] = useState(null);
  const [error, setError] = useState(null);
  const panelRef = useRef(null);
  useClickOutside(panelRef, onClose);

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

  const sendReply = async (text, _replyToMessageId, attachment) => {
    const reply = await onSendMessage(text, rootMessage.id, attachment);
    if (reply) setThread((current) => ({ ...(current ?? rootMessage), replies: [...(current?.replies ?? []), reply] }));
    return reply;
  };

  return (
    <aside className="thread-panel" ref={panelRef}>
      <header><h3>Thread</h3><button type="button" onClick={onClose} aria-label="Close thread">×</button></header>
      <div className="thread-content">
        <ThreadMessage message={thread ?? rootMessage} />
        <div className="thread-divider">{replies.length} {replies.length === 1 ? "reply" : "replies"}</div>
        {error && <p>{error}</p>}
        {replies.map((reply) => <ThreadMessage key={reply.id} message={reply} />)}
      </div>
      <MessageInput conversationId={conversationId} onSendMessage={sendReply} draftKey={`thread:${conversationId}:${rootMessage.id}`} />
    </aside>
  );
}

export default ThreadPanel;
