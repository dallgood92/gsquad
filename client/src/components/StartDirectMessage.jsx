import { useState } from "react";
import { createDirectConversation, searchUsers } from "../services/api";

function StartDirectMessage({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);

  const search = async (event) => {
    const value = event.target.value;
    setQuery(value);
    setError(null);
    if (value.trim().length < 2) return setUsers([]);
    try { setUsers(await searchUsers(value)); }
    catch (requestError) { setError(requestError.message); }
  };

  const start = async (userId) => {
    try {
      const conversation = await createDirectConversation(userId);
      onCreated(conversation);
      setOpen(false);
      setQuery("");
      setUsers([]);
    } catch (requestError) { setError(requestError.message); }
  };

  return <div className="start-direct-message">
    <button type="button" onClick={() => setOpen((current) => !current)}>New message</button>
    {open && <div className="direct-message-search">
      <input type="search" value={query} onChange={search} placeholder="Find a person..." autoFocus />
      {error && <p>{error}</p>}
      {users.map((user) => <button type="button" key={user.id} onClick={() => start(user.id)}><strong>{user.name}</strong><span>{user.email}</span></button>)}
    </div>}
  </div>;
}

export default StartDirectMessage;
