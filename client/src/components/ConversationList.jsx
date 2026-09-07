import { useEffect, useState } from "react";
import StartDirectMessage from "./StartDirectMessage";
import Avatar from "./Avatar";
import Logo from "./Logo";
import ProfileModal from "./ProfileModal";

function ConversationList({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onCreateConversation,
  currentUserId,
  onDirectConversationCreated,
  currentUser,
  onLogout,
  onArchiveConversation,
  onLeaveConversation,
  onDeleteConversation,
  friendRequestsRevision,
  recentlyAddedConversationId,
  onUserUpdated,
}) {
  const [name, setName] =
    useState("");

  const [showForm, setShowForm] =
    useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [sidebarView, setSidebarView] = useState("chats");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [groupToLeave, setGroupToLeave] = useState(null);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!openMenuId) return undefined;
    const close = (event) => {
      if (!event.target.closest(".conversation-item-menu")) setOpenMenuId(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [openMenuId]);

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    await onCreateConversation(
      name
    );

    setName("");
    setShowForm(false);
  };

  const groups = conversations.filter((conversation) => conversation.type !== "DIRECT");
  const directMessages = conversations.filter((conversation) => conversation.type === "DIRECT");

  const runConversationAction = async (action) => {
    try {
      setActionError("");
      setOpenMenuId(null);
      await action();
    } catch (error) {
      setActionError(error.message || "That action could not be completed.");
    }
  };

  const renderConversation = (conversation) => {
    const otherMember = conversation.members.find((membership) => membership.userId !== currentUserId);
    const displayName = conversation.type === "DIRECT" ? otherMember?.user.name ?? conversation.name : conversation.name;

    return (
      <div
        role="button"
        tabIndex={0}
        key={conversation.id}
        className={`${conversation.id === selectedConversationId ? "conversation active" : "conversation"} ${conversation.id === recentlyAddedConversationId ? "conversation-new" : ""}`}
        onClick={() => onSelectConversation(conversation.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onSelectConversation(conversation.id);
        }}
      >
        <Avatar user={conversation.type === "DIRECT" ? otherMember?.user : null} name={displayName} />
        <span className="conversation-copy">
          <span className="conversation-name">{displayName}</span>
          <span className="conversation-preview">{conversation.lastMessage ? (conversation.type === "DIRECT" ? (conversation.lastMessage.text || (conversation.lastMessage.attachments?.[0]?.mimeType?.startsWith("video/") ? "Video" : "Photo")) : `${conversation.lastMessage.sender?.name}: ${conversation.lastMessage.text || (conversation.lastMessage.attachments?.[0]?.mimeType?.startsWith("video/") ? "Video" : "Photo")}`) : "No messages yet"}</span>
        </span>
        <div className="conversation-signals">
          {conversation.members.find((membership) => membership.userId === currentUserId)?.notificationsMuted && <span className="muted-icon" title="Notifications muted">⌁</span>}
          {conversation.unreadCount > 0 && <span className="unread-badge">{conversation.unreadCount}</span>}
          {conversation.id === recentlyAddedConversationId && <span className="new-conversation-badge">New</span>}
          <div className="conversation-item-menu">
            <button type="button" aria-label={`Options for ${displayName}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setOpenMenuId((current) => current === conversation.id ? null : conversation.id); }}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg></button>
            {openMenuId === conversation.id && <div className="conversation-item-popover" onClick={(event) => event.stopPropagation()}>
              <button type="button" onClick={() => runConversationAction(() => onArchiveConversation(conversation))}>Archive</button>
              {conversation.type !== "DIRECT" && <button type="button" onClick={() => { setOpenMenuId(null); setActionError(""); setGroupToLeave(conversation); }}>Leave group</button>}
              {conversation.type !== "DIRECT" && conversation.createdById === currentUserId && <button className="danger-action" type="button" onClick={() => {
                setOpenMenuId(null);
                setGroupToDelete(conversation);
              }}>Delete group</button>}
              {conversation.type === "DIRECT" && <button className="danger-action" type="button" onClick={() => {
                setOpenMenuId(null);
                setGroupToDelete(conversation);
              }}>Delete conversation</button>}
            </div>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Logo size={34} />
        <span>GSQUAD</span>
      </div>
      <div className="conversation-header">
        <div><p className="eyebrow">WORKSPACE</p><h2>Messages</h2></div>
      </div>

      <div className="conversation-list" aria-label="Conversations">
        <div className="sidebar-view-tabs">
          <button className={sidebarView === "chats" ? "active" : ""} type="button" onClick={() => setSidebarView("chats")}>Chats</button>
          <button className={sidebarView === "friends" ? "active" : ""} type="button" onClick={() => setSidebarView("friends")}>Friends</button>
        </div>
        {sidebarView === "friends" ? <StartDirectMessage embedded mode="friends" onCreated={(conversation) => { setSidebarView("chats"); onDirectConversationCreated(conversation); }} requestsRevision={friendRequestsRevision} /> : <>
        <section className="conversation-section">
          <div className="group-section-heading direct-section-heading"><h3>Direct Messages <span>{directMessages.length}</span></h3><StartDirectMessage mode="message" onCreated={onDirectConversationCreated} requestsRevision={friendRequestsRevision} /></div>
          {directMessages.map(renderConversation)}
          {directMessages.length === 0 && <p className="conversation-empty">No direct messages yet</p>}
        </section>
        <section className="conversation-section">
          <div className="group-section-heading"><h3>Groups <span>{groups.length}</span></h3><button type="button" onClick={() => setShowForm((current) => !current)} aria-expanded={showForm}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>New group</span>
          </button></div>
          {showForm && (
            <form className="conversation-form" onSubmit={handleSubmit}>
              <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Group name" autoFocus />
              <button type="submit">Create</button>
            </form>
          )}
          {groups.map(renderConversation)}
          {groups.length === 0 && <p className="conversation-empty">No groups yet</p>}
        </section>
        </>}
      </div>
      <div className="sidebar-profile">
        <button className="profile-trigger" type="button" onClick={() => setShowProfile(true)}>
          <Avatar user={currentUser} size="small" online />
          <span><strong>{currentUser?.name}</strong><small>View profile</small></span>
        </button>
      </div>
      {showProfile && <ProfileModal user={currentUser} onClose={() => setShowProfile(false)} onLogout={onLogout} onUserUpdated={onUserUpdated} />}
      {actionError && <div className="app-toast app-toast-error" role="status"><span>{actionError}</span><button type="button" aria-label="Dismiss" onClick={() => setActionError("")}>×</button></div>}
      {groupToLeave && <div className="delete-group-backdrop" onPointerDown={(event) => {
        if (event.target === event.currentTarget && !leavingGroup) setGroupToLeave(null);
      }}>
        <section className="delete-group-modal" role="alertdialog" aria-modal="true" aria-labelledby="leave-group-title">
          <div className="leave-warning-icon">↗</div>
          <h2 id="leave-group-title">Leave “{groupToLeave.name}”?</h2>
          <p>You’ll stop receiving messages from this group. The owner can invite you again later.</p>
          {actionError && <p className="dialog-error">{actionError}</p>}
          <div>
            <button type="button" disabled={leavingGroup} onClick={() => setGroupToLeave(null)}>Cancel</button>
            <button className="danger-action" type="button" disabled={leavingGroup} onClick={async () => {
              try {
                setActionError("");
                setLeavingGroup(true);
                await onLeaveConversation(groupToLeave);
                setGroupToLeave(null);
              } catch (error) {
                setActionError(error.message || "The group could not be left.");
              } finally {
                setLeavingGroup(false);
              }
            }}>{leavingGroup ? "Leaving…" : "Leave group"}</button>
          </div>
        </section>
      </div>}
      {groupToDelete && <div className="delete-group-backdrop" onPointerDown={(event) => {
        if (event.target === event.currentTarget && !deletingGroup) setGroupToDelete(null);
      }}>
        <form className="delete-group-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-group-title" onSubmit={async (event) => {
          event.preventDefault();
          if (deletingGroup) return;
          try {
            setActionError("");
            setDeletingGroup(true);
            await onDeleteConversation(groupToDelete);
            setGroupToDelete(null);
          } catch (error) {
            setActionError(error.message || "The conversation could not be deleted.");
          } finally {
            setDeletingGroup(false);
          }
        }}>
          <div className="delete-warning-icon">!</div>
          <h2 id="delete-group-title">Delete “{groupToDelete.type === "DIRECT" ? (groupToDelete.members.find((membership) => membership.userId !== currentUserId)?.user.name ?? groupToDelete.name) : groupToDelete.name}”?</h2>
          <p>{groupToDelete.type === "DIRECT" ? "This permanently deletes the conversation and its message history for both people. This can’t be undone." : "This permanently deletes the group and its message history for every member. This can’t be undone."}</p>
          <div>
            <button type="button" disabled={deletingGroup} onClick={() => setGroupToDelete(null)}>Cancel</button>
            <button className="danger-action" type="submit" disabled={deletingGroup}>{deletingGroup ? "Deleting…" : groupToDelete.type === "DIRECT" ? "Delete conversation" : "Delete for everyone"}</button>
          </div>
        </form>
      </div>}
    </aside>
  );
}

export default ConversationList;
