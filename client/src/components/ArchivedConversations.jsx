import { useCallback, useEffect, useRef, useState } from "react";
import { getArchivedConversations, setConversationArchived } from "../services/api";
import useClickOutside from "../hooks/useClickOutside";
import Avatar from "./Avatar";

function ArchivedConversations({ revision, onRestore }) {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [restoringId, setRestoringId] = useState(null);
  const rootRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(rootRef, close, open);

  useEffect(() => {
    let active = true;
    getArchivedConversations().then((data) => active && setConversations(data.conversations))
      .catch((error) => console.error("Failed to load archived conversations:", error));
    return () => { active = false; };
  }, [revision]);

  const restore = async (conversationId) => {
    try {
      setRestoringId(conversationId);
      await setConversationArchived(conversationId, false);
      setConversations((items) => items.filter((item) => item.id !== conversationId));
      onRestore();
    } finally {
      setRestoringId(null);
    }
  };

  return <div className="archived-conversations" ref={rootRef}>
    <button type="button" onClick={() => setOpen((current) => !current)} aria-label="Archived conversations" title="Archived conversations">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v13H4zM3 4h18v3H3zm6 7h6" /></svg>
    </button>
    {open && <div className="archived-list">
      <div className="archived-header"><div><strong>Archived</strong><span>Conversations you’ve tucked away</span></div><button type="button" aria-label="Close archived conversations" onClick={() => setOpen(false)}>×</button></div>
      {conversations.length === 0 && <div className="archived-empty"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v13H4zM3 4h18v3H3zm6 5h6" /></svg></span><strong>No archived conversations</strong><p>Archived chats will appear here.</p></div>}
      {conversations.map((conversation) => <div className="archived-item" key={conversation.id}><Avatar name={conversation.name} size="small"/><span><strong>{conversation.name}</strong><small>{conversation.type === "DIRECT" ? "Direct message" : "Group"}</small></span><button type="button" disabled={restoringId === conversation.id} onClick={() => restore(conversation.id)}>{restoringId === conversation.id ? "Restoring…" : "Restore"}</button></div>)}
    </div>}
  </div>;
}

export default ArchivedConversations;
