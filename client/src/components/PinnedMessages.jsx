import { useRef, useEffect, useState } from "react";
import { getPinnedMessages } from "../services/api";
import useClickOutside from "../hooks/useClickOutside";

function PinnedMessages({ conversationId, revision, onClose, onSelect }) {
  const [pins, setPins] = useState([]);
  const [error, setError] = useState(null);
  const panelRef = useRef(null);
  useClickOutside(panelRef, onClose);

  useEffect(() => {
    let active = true;
    getPinnedMessages(conversationId)
      .then((data) => active && setPins(data.pins))
      .catch((requestError) => active && setError(requestError.message));
    return () => { active = false; };
  }, [conversationId, revision]);

  return (
    <aside className="pinned-panel" ref={panelRef}>
      <header><h3>Pinned messages</h3><button type="button" onClick={onClose} aria-label="Close pinned messages">×</button></header>
      <div className="pinned-content">
        {error && <p>{error}</p>}
        {!error && pins.length === 0 && <p>No pinned messages yet.</p>}
        {pins.map((pin) => (
          <button type="button" className="pinned-message" key={pin.id} onClick={() => onSelect(pin.message)}>
            <span><strong>{pin.message.sender.name}</strong> · pinned by {pin.pinnedBy.name}</span>
            <span>{pin.message.text}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

export default PinnedMessages;
