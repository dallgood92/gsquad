import { useEffect, useState } from "react";
import { getNotifications, markNotificationsRead } from "../services/api";

function NotificationCenter({ revision, onSelect }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getNotifications()
      .then((data) => active && setNotifications(data.notifications))
      .catch((error) => console.error("Failed to load notifications:", error));
    return () => { active = false; };
  }, [revision]);

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const toggleOpen = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && unreadCount) {
      try {
        await markNotificationsRead();
        setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
      } catch (error) {
        console.error("Failed to mark notifications read:", error);
      }
    }
  };

  return (
    <div className="notification-center">
      <button type="button" onClick={toggleOpen}>Notifications{unreadCount ? ` (${unreadCount})` : ""}</button>
      {open && (
        <div className="notification-list">
          <div className="notification-header"><strong>Mentions</strong><button type="button" onClick={toggleOpen}>×</button></div>
          {notifications.length === 0 && <p>No mentions yet.</p>}
          {notifications.map((notification) => (
            <button type="button" className="notification-item" key={notification.id} onClick={() => { onSelect(notification); setOpen(false); }}>
              <span><strong>{notification.actor.name}</strong> mentioned you in {notification.conversation.name}</span>
              <span>{notification.message.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default NotificationCenter;
