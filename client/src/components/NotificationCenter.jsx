import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clearNotifications, dismissNotification, getNotifications, markNotificationsRead } from "../services/api";
import { acceptFriendRequest, getFriendRequests, removeFriend } from "../services/api";
import useClickOutside from "../hooks/useClickOutside";
import Avatar from "./Avatar";

function NotificationCenter({ revision, friendRequestsRevision, groupInvites, onSelect, onSelectGroupInvite }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [friendRequests, setFriendRequests] = useState([]);
  const [toast, setToast] = useState(null);
  const [acceptingId, setAcceptingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [clearing, setClearing] = useState(false);
  const rootRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(rootRef, close, open);

  useEffect(() => {
    let active = true;
    getNotifications()
      .then((data) => active && setNotifications(data.notifications))
      .catch((error) => console.error("Failed to load notifications:", error));
    return () => { active = false; };
  }, [revision]);

  useEffect(() => {
    getFriendRequests()
      .then((requests) => setFriendRequests(requests.received))
      .catch((error) => console.error("Failed to load friend requests:", error));
  }, [friendRequestsRevision]);

  const unreadCount = notifications.filter((notification) => !notification.readAt).length + friendRequests.length + groupInvites.length;
  const acceptRequest = async (person) => {
    try {
      setAcceptingId(person.id);
      setActionError("");
      await acceptFriendRequest(person.id);
      setFriendRequests((current) => current.filter((request) => request.id !== person.id));
      setToast(`You and ${person.name} are now friends`);
      window.setTimeout(() => setToast(null), 5000);
    } catch (error) {
      if (error.message === "Friend request not found") {
        setFriendRequests((current) => current.filter((request) => request.id !== person.id));
        setActionError("This friend request is no longer available.");
      } else {
        setActionError(error.message || "The request could not be accepted");
      }
    } finally {
      setAcceptingId(null);
    }
  };
  const declineRequest = async (person) => {
    await removeFriend(person.id);
    setFriendRequests((current) => current.filter((request) => request.id !== person.id));
  };
  const toggleOpen = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      try {
        const requests = await getFriendRequests();
        setFriendRequests(requests.received);
        setActionError("");
        if (unreadCount) {
          await markNotificationsRead();
          setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
        }
      } catch (error) {
        console.error("Failed to refresh notifications:", error);
      }
    }
  };

  const dismiss = async (notification) => {
    setNotifications((items) => items.filter((item) => item.id !== notification.id));
    try {
      await dismissNotification(notification.id);
    } catch (error) {
      setNotifications((items) => items.some((item) => item.id === notification.id) ? items : [notification, ...items]);
      setActionError(error.message || "The notification could not be removed");
    }
  };

  const clearAll = async () => {
    const previous = notifications;
    setClearing(true);
    setNotifications([]);
    try {
      await clearNotifications();
    } catch (error) {
      setNotifications(previous);
      setActionError(error.message || "Notifications could not be cleared");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="notification-center" ref={rootRef}>
      <button type="button" onClick={toggleOpen} aria-label="Notifications" title="Notifications">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
        {unreadCount > 0 && <span className="toolbar-badge">{unreadCount}</span>}
      </button>
      {open && (
        <div className="notification-list">
          <div className="notification-header"><strong>Notifications</strong><div>{notifications.length > 0 && <button className="notification-clear" type="button" disabled={clearing} onClick={clearAll}>{clearing ? "Clearing…" : "Clear all"}</button>}<button className="notification-close" type="button" aria-label="Close notifications" onClick={toggleOpen}>×</button></div></div>
          {friendRequests.length > 0 && <div className="notification-friend-requests">
            <strong>Friend requests</strong>
            {friendRequests.map((person) => <div className="notification-request" key={person.id}><span><strong>{person.name}</strong><small>Sent you a friend request</small></span><div><button type="button" disabled={acceptingId === person.id} onClick={(event) => { event.stopPropagation(); acceptRequest(person); }}>{acceptingId === person.id ? "Accepting…" : "Accept"}</button><button type="button" disabled={acceptingId === person.id} onClick={() => declineRequest(person)}>Decline</button></div></div>)}
            {actionError && <p className="notification-action-error">{actionError}</p>}
          </div>}
          {groupInvites.length > 0 && <div className="notification-group-invites">
            <strong>Group invitations</strong>
            {groupInvites.map((conversation) => <button type="button" key={conversation.id} onClick={() => { onSelectGroupInvite(conversation); setOpen(false); }}><span>You were added to</span><strong>{conversation.name}</strong></button>)}
          </div>}
          {notifications.length === 0 && friendRequests.length === 0 && groupInvites.length === 0 && <div className="notification-empty"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg></span><strong>You’re all caught up</strong><p>New activity will appear here.</p></div>}
          {notifications.map((notification) => (
            <button type="button" className={`notification-item ${notification.type === "FRIEND_ACCEPTED" ? "friend-accepted-notification" : ""}`} key={notification.id} onClick={async () => {
              if (notification.type !== "FRIEND_ACCEPTED") onSelect(notification);
              await dismiss(notification);
              setOpen(false);
            }}>
              {notification.type === "FRIEND_ACCEPTED" ? <><Avatar user={notification.actor} size="small" /><span className="friend-accepted-copy"><strong>You and {notification.actor.name} are now friends</strong><small>You can now send each other messages.</small></span><span className="friend-accepted-check" aria-hidden="true">✓</span></> : <><span><strong>{notification.actor.name}</strong> mentioned you in {notification.conversation.name}</span><span>{notification.message.text}</span></>}
            </button>
          ))}
        </div>
      )}
      {toast && createPortal(<div className="friend-toast success" role="status">{toast}</div>, document.body)}
    </div>
  );
}

export default NotificationCenter;
