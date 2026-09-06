import { useEffect, useState } from "react";
import { acceptFriendRequest, getFriendRequests, getFriends, updateCurrentUser } from "../services/api";
import Avatar from "./Avatar";

function getInitialTheme() {
  return localStorage.getItem("theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

function ProfileModal({ user, onClose, onLogout, onUserUpdated }) {
  const [friends, setFriends] = useState([]);
  const [theme, setTheme] = useState(getInitialTheme);
  const [requests, setRequests] = useState([]);
  const [displayName, setDisplayName] = useState(user.name);
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    Promise.all([getFriends(), getFriendRequests()])
      .then(([savedFriends, friendRequests]) => { setFriends(savedFriends); setRequests(friendRequests.received); })
      .catch(() => { setFriends([]); setRequests([]); });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const changeTheme = (nextTheme) => {
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
  };

  const acceptRequest = async (person) => {
    await acceptFriendRequest(person.id);
    setRequests((current) => current.filter((request) => request.id !== person.id));
    setFriends((current) => [...current, person]);
  };

  const saveDisplayName = async (event) => {
    event.preventDefault();
    const nextName = displayName.trim();
    if (!nextName) return;
    try {
      setSavingName(true);
      setNameError("");
      const result = await updateCurrentUser(nextName);
      onUserUpdated(result.user);
      setDisplayName(result.user.name);
      setEditingName(false);
    } catch (error) {
      setNameError(error.message);
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="profile-modal-backdrop" role="presentation" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <header>
          <span>Account</span>
          <button type="button" onClick={onClose} aria-label="Close account">×</button>
        </header>
        <div className="profile-identity">
          <Avatar user={user} online />
          <div className="profile-identity-copy">
            <div className="profile-name-heading"><h2 id="profile-title">{user.name}</h2><button type="button" onClick={() => { setDisplayName(user.name); setNameError(""); setEditingName(true); }}>Edit</button></div>
            <p>{user.email}</p>
          </div>
        </div>
        {editingName && <form className="profile-name-form" onSubmit={saveDisplayName}>
          <label htmlFor="display-name">Display name</label>
          <input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={40} autoFocus />
          {nameError && <span className="profile-name-error">{nameError}</span>}
          <div><button type="button" disabled={savingName} onClick={() => setEditingName(false)}>Cancel</button><button type="submit" disabled={savingName || !displayName.trim()}>{savingName ? "Saving…" : "Save"}</button></div>
        </form>}
        <div className="profile-section">
          <div className="profile-section-heading"><strong>Friends</strong><span>{friends.length}</span></div>
          <div className="profile-friends">
            {requests.map((person) => <div className="profile-friend-request" key={`request:${person.id}`}><Avatar user={person} size="small" /><span><strong>{person.name}</strong><small>Friend request</small></span><button type="button" onClick={() => acceptRequest(person)}>Accept</button></div>)}
            {friends.map((friend) => <div key={friend.id}><Avatar user={friend} size="small" /><span>{friend.name}</span></div>)}
            {friends.length === 0 && <p>No friends added yet.</p>}
          </div>
        </div>
        <div className="profile-section">
          <strong>Appearance</strong>
          <div className="theme-picker" aria-label="Appearance">
            <button className={theme === "light" ? "active" : ""} type="button" onClick={() => changeTheme("light")}>Light</button>
            <button className={theme === "dark" ? "active" : ""} type="button" onClick={() => changeTheme("dark")}>Dark</button>
          </div>
        </div>
        <button className="profile-sign-out" type="button" onClick={onLogout}>Sign out</button>
      </section>
    </div>
  );
}

export default ProfileModal;
