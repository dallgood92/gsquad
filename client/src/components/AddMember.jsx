import { useCallback, useEffect, useRef, useState } from "react";
import {
  addConversationMember,
  getFriends,
  searchUsers,
} from "../services/api";
import useClickOutside from "../hooks/useClickOutside";
import Avatar from "./Avatar";

function AddMember({ conversationId, onMemberAdded, memberIds }) {
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [friends, setFriends] = useState([]);
  const [searchMode, setSearchMode] = useState(false);
  const rootRef = useRef(null);
  const close = useCallback(() => setShowSearch(false), []);
  useClickOutside(rootRef, close, showSearch);

  useEffect(() => {
    if (showSearch) getFriends().then(setFriends).catch((requestError) => setError(requestError.message));
  }, [showSearch]);

  const handleSearch = async (event) => {
    const value = event.target.value;

    setSearch(value);
    setError(null);

    if (value.trim().length < 2) {
      setUsers([]);
      return;
    }

    try {
      const results = await searchUsers(value);

      setUsers(results);
    } catch (error) {
      console.error("Failed to search users:", error);
      setError(error.message);
    }
  };

  const handleAddMember = async (user) => {
    try {
      setError(null);

      const membership = await addConversationMember(
        conversationId,
        user.id
      );

      onMemberAdded(membership);

      setSearch("");
      setUsers([]);
      setShowSearch(false);
    } catch (error) {
      console.error("Failed to add member:", error);
      setError(error.message);
    }
  };

  return (
    <div className="add-member" ref={rootRef}>
      <button
        type="button"
        onClick={() =>
          setShowSearch((current) => !current)
        }
      >
        Add People
      </button>

      {showSearch && (
        <div className="member-search">
          <div className="popover-title"><div><strong>Add people</strong><span>Choose someone to invite to this group.</span></div></div>
          <div className="member-search-results">
            {!searchMode && friends.filter((friend) => !memberIds.includes(friend.id)).map((friend) => (
              <button className="member-result" key={friend.id} type="button" onClick={() => handleAddMember(friend)}>
                <Avatar user={friend} size="small" />
                <span><strong>{friend.name}</strong><small>{friend.email}</small></span>
                <span className="member-add-label">Add</span>
              </button>
            ))}
            {!searchMode && friends.filter((friend) => !memberIds.includes(friend.id)).length === 0 && <p className="empty-popover">All your friends are already in this group.</p>}
          </div>
          <button className="search-people-toggle" type="button" onClick={() => { setSearchMode((current) => !current); setSearch(""); setUsers([]); }}>
            {searchMode ? "Back to friends" : "Search other people"}
          </button>
          {searchMode && <div className="people-search-field"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg><input
            type="search"
            value={search}
            onChange={handleSearch}
            placeholder="Search by name or email"
            autoFocus
          /></div>}

          {error && <p>{error}</p>}

          {searchMode && <div className="member-search-results">
            {users.filter((user) => !memberIds.includes(user.id)).map((user) => (
              <button
                className="member-result"
                key={user.id}
                type="button"
                onClick={() => handleAddMember(user)}
              >
                <Avatar user={user} size="small" />
                <span><strong>{user.name}</strong><small>{user.email}</small></span>
                <span className="member-add-label">Invite</span>
              </button>
            ))}
          </div>}
        </div>
      )}
    </div>
  );
}

export default AddMember;
