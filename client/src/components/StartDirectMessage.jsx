import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { acceptFriendRequest, addFriend, blockUser, createDirectConversation, getBlockedUsers, getFriendRequests, getFriends, removeFriend, searchUsers, unblockUser } from "../services/api";
import useClickOutside from "../hooks/useClickOutside";
import Avatar from "./Avatar";

function StartDirectMessage({ onCreated, requestsRevision, mode = "friends", embedded = false }) {
  const [openPanel, setOpenPanel] = useState(null);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [friends, setFriends] = useState([]);
  const [pendingSent, setPendingSent] = useState([]);
  const [pendingReceived, setPendingReceived] = useState([]);
  const [toast, setToast] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const toastTimeoutRef = useRef(null);
  const rootRef = useRef(null);
  const close = useCallback(() => setOpenPanel(null), []);
  useClickOutside(rootRef, close, !embedded && Boolean(openPanel));

  const activePanel = embedded ? mode : openPanel;
  const presentToast = useCallback((nextToast) => {
    window.clearTimeout(toastTimeoutRef.current);
    setToast(nextToast);
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    if (activePanel) Promise.all([getFriends(), getFriendRequests(), getBlockedUsers()])
      .then(([savedFriends, requests, blocked]) => { setFriends(savedFriends); setPendingSent(requests.sent); setPendingReceived(requests.received); setBlockedUsers(blocked); })
      .catch((requestError) => setError(requestError.message));
  }, [activePanel, requestsRevision]);

  useEffect(() => {
    getFriendRequests().then((requests) => { setPendingSent(requests.sent); setPendingReceived(requests.received); }).catch(() => {});
  }, [requestsRevision]);

  useEffect(() => {
    const showFriendshipToast = (event) => {
      presentToast(event.detail);
    };
    window.addEventListener("friendship-toast", showFriendshipToast);
    return () => window.removeEventListener("friendship-toast", showFriendshipToast);
  }, [presentToast]);

  useEffect(() => () => window.clearTimeout(toastTimeoutRef.current), []);

  const saveFriend = async (user) => {
    try {
      const request = await addFriend(user.id);
      setPendingSent((current) => [...current, request.friend]);
      presentToast({ message: `Request sent to ${request.friend.name}`, tone: "pending" });
    } catch (requestError) { setError(requestError.message); }
  };

  const acceptRequest = async (person) => {
    try {
      await acceptFriendRequest(person.id);
      setPendingReceived((current) => current.filter((request) => request.id !== person.id));
      setFriends((current) => [...current, person]);
      presentToast({ message: `You and ${person.name} are now friends`, tone: "success" });
    } catch (requestError) { setError(requestError.message); }
  };

  const declineRequest = async (person) => {
    try {
      await removeFriend(person.id);
      setPendingReceived((current) => current.filter((request) => request.id !== person.id));
    } catch (requestError) { setError(requestError.message); }
  };

  const unfriend = async (person) => {
    try {
      await removeFriend(person.id);
      setFriends((current) => current.filter((friend) => friend.id !== person.id));
    } catch (requestError) { setError(requestError.message); }
  };

  const cancelRequest = async (person) => {
    try {
      await removeFriend(person.id);
      setPendingSent((current) => current.filter((request) => request.id !== person.id));
      presentToast({ message: `Friend request to ${person.name} canceled`, tone: "pending" });
    } catch (requestError) { setError(requestError.message); }
  };

  const block = async (person) => {
    try {
      await blockUser(person.id);
      setFriends((current) => current.filter((friend) => friend.id !== person.id));
      setPendingReceived((current) => current.filter((request) => request.id !== person.id));
      setPendingSent((current) => current.filter((request) => request.id !== person.id));
      setBlockedUsers((current) => current.some((user) => user.id === person.id) ? current : [...current, person]);
      presentToast({ message: `${person.name} was blocked`, tone: "pending" });
    } catch (requestError) { setError(requestError.message); }
  };

  const unblock = async (person) => {
    try {
      await unblockUser(person.id);
      setBlockedUsers((current) => current.filter((user) => user.id !== person.id));
    } catch (requestError) { setError(requestError.message); }
  };

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
      setOpenPanel(null);
      setQuery("");
      setUsers([]);
    } catch (requestError) { setError(requestError.message); }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const visibleUsers = activePanel === "message"
    ? friends.filter((person) => !normalizedQuery || person.name.toLowerCase().includes(normalizedQuery) || person.email.toLowerCase().includes(normalizedQuery))
    : normalizedQuery.length >= 2 ? users : friends;

  return <div className={`start-direct-message ${embedded ? "embedded-friends" : ""}`} ref={rootRef}>
    {!embedded && <div className="sidebar-quick-actions">
      {mode === "friends" && <button className={!openPanel ? "active" : ""} type="button" onClick={() => setOpenPanel(null)}>Chats</button>}
      <button className={openPanel === mode ? "active" : ""} type="button" onClick={() => setOpenPanel((current) => current === mode ? null : mode)}>
        {mode === "message" && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>}
        {mode === "message" ? "New message" : "Friends"}
        {mode === "friends" && pendingReceived.length > 0 && <span className="friend-request-badge">{pendingReceived.length}</span>}
      </button>
    </div>}
    {activePanel && <div className="direct-message-search">
      <div className="popover-title">
        <div><strong>{activePanel === "friends" ? "Friends" : "New message"}</strong>
        <span>{activePanel === "friends" ? "People you’ve chosen to connect with." : "Choose a friend to start a conversation."}</span></div>
      </div>
      <div className="people-search-field"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg><input type="search" value={query} onChange={search} placeholder={activePanel === "message" ? "Search friends" : "Search by name or email"} autoFocus /></div>
      {error && <p>{error}</p>}
      <div className="direct-message-results">
        {activePanel === "friends" && !query && pendingReceived.length > 0 && <div className="friend-request-heading">Requests</div>}
        {activePanel === "friends" && !query && pendingReceived.map((person) => <div className="person-result" key={`request:${person.id}`}>
          <Avatar user={person} size="small" />
          <div className="person-primary"><strong>{person.name}</strong><span>Wants to be your friend</span></div>
          <div className="request-actions"><button type="button" onClick={() => acceptRequest(person)}>Accept</button><button type="button" onClick={() => declineRequest(person)}>Decline</button></div>
        </div>)}
        {activePanel === "friends" && !query && friends.length > 0 && <div className="friend-request-heading">Friends</div>}
        {visibleUsers.map((person) => {
          const canMessage = friends.some((friend) => friend.id === person.id);
          return <div className="person-result" key={person.id}>
          <Avatar user={person} size="small" />
          <button className="person-primary" type="button" disabled={!canMessage} onClick={() => canMessage && start(person.id)}><strong>{person.name}</strong><span>{person.email}</span></button>
          {activePanel === "message" && canMessage
            ? <button className="friend-action open-chat-action" type="button" onClick={() => start(person.id)}>Open</button>
            : friends.some((friend) => friend.id === person.id)
            ? <div className="friend-row-actions"><button className="friend-action unfriend-action" type="button" onClick={() => unfriend(person)}>Unfriend</button><button className="friend-action block-action" type="button" onClick={() => block(person)}>Block</button></div>
            : pendingReceived.some((request) => request.id === person.id)
              ? <div className="friend-row-actions"><button className="friend-action" type="button" onClick={() => acceptRequest(person)}>Accept</button><button className="friend-action block-action" type="button" onClick={() => block(person)}>Block</button></div>
            : pendingSent.some((friend) => friend.id === person.id)
              ? <div className="friend-row-actions"><button className="friend-action pending-action" type="button" title="Cancel friend request" onClick={() => cancelRequest(person)}>Pending</button><button className="friend-action block-action" type="button" onClick={() => block(person)}>Block</button></div>
            : <div className="friend-row-actions"><button className="friend-action" type="button" onClick={() => saveFriend(person)}>Add friend</button><button className="friend-action block-action" type="button" onClick={() => block(person)}>Block</button></div>}
        </div>;
        })}
        {activePanel === "friends" && !query && blockedUsers.length > 0 && <div className="friend-request-heading">Blocked</div>}
        {activePanel === "friends" && !query && blockedUsers.map((person) => <div className="person-result blocked-person" key={`blocked:${person.id}`}>
          <Avatar user={person} size="small" />
          <div className="person-primary"><strong>{person.name}</strong><span>Blocked</span></div>
          <button className="friend-action" type="button" onClick={() => unblock(person)}>Unblock</button>
        </div>)}
        {!query && friends.length === 0 && pendingReceived.length === 0 && <p className="empty-popover">Search for someone, then send a friend request.</p>}
      </div>
    </div>}
    {toast && createPortal(<div className={`friend-toast ${toast.tone === "success" ? "success" : "pending"}`} role="status">{toast.message}</div>, document.body)}
  </div>;
}

export default StartDirectMessage;
