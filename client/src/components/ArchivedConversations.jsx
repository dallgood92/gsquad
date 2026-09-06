import { useEffect, useState } from "react";
import { getArchivedConversations, setConversationArchived } from "../services/api";

function ArchivedConversations({ revision, onRestore }) {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    let active = true;
    getArchivedConversations().then((data) => active && setConversations(data.conversations))
      .catch((error) => console.error("Failed to load archived conversations:", error));
    return () => { active = false; };
  }, [revision]);

  const restore = async (conversationId) => {
    await setConversationArchived(conversationId, false);
    setConversations((items) => items.filter((item) => item.id !== conversationId));
    onRestore();
  };

  return <div className="archived-conversations">
    <button type="button" onClick={() => setOpen((current) => !current)}>Archived ({conversations.length})</button>
    {open && <div className="archived-list">
      <div className="archived-header"><strong>Archived conversations</strong><button type="button" onClick={() => setOpen(false)}>×</button></div>
      {conversations.length === 0 && <p>No archived conversations.</p>}
      {conversations.map((conversation) => <div className="archived-item" key={conversation.id}><span>{conversation.name}</span><button type="button" onClick={() => restore(conversation.id)}>Restore</button></div>)}
    </div>}
  </div>;
}

export default ArchivedConversations;
