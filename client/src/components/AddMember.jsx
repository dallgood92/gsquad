import { useState } from "react";
import {
  addConversationMember,
  searchUsers,
} from "../services/api";

function AddMember({ conversationId, onMemberAdded }) {
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);

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
    <div className="add-member">
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
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Search by name or email"
            autoFocus
          />

          {error && <p>{error}</p>}

          <div className="member-search-results">
            {users.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleAddMember(user)}
              >
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AddMember;