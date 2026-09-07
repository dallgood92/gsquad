import {
  useCallback,
  useRef,
  useState,
} from "react";

import AddMember from "./components/AddMember";
import ConversationList from "./components/ConversationList";
import MessageList from "./components/MessageList";
import MessageSearch from "./components/MessageSearch";
import MessageInput from "./components/MessageInput";
import PinnedMessages from "./components/PinnedMessages";
import NotificationCenter from "./components/NotificationCenter";
import ArchivedConversations from "./components/ArchivedConversations";
import Avatar from "./components/Avatar";
import LoginPage from "./pages/LoginPage";

import useAuth from "./hooks/useAuth";
import useConversations from "./hooks/useConversations";
import usePresence from "./hooks/usePresence";
import useWebSocket from "./hooks/useWebSocket";
import useClickOutside from "./hooks/useClickOutside";

import {
  renameConversation,
  deleteConversation,
  removeConversationMember,
  updateConversationMemberRole,
  updateNotificationPreferences,
  setConversationArchived,
} from "./services/api";

function App() {
  const {
    user,
    loading: authLoading,
    login,
    updateUser,
    logout,
  } = useAuth();

  const {
    conversations,
    selectedConversation,
    selectedConversationId,
    selectedTypingUsers,
    selectConversation,
    createConversation,
    addMemberToConversation,
    receiveConversation,
    receiveConversationDelete,
    receiveMessage,
    receiveMessageUpdate,
    receiveMessageDelete,
    receiveReadReceipt,
    receiveMembershipUpdate,
    editMessage,
    deleteMessage,
    toggleMessagePin,
    loadOlderMessages,
    startTyping,
    stopTyping,
    sendMessage,
    retryMessage,
    resync,
    loading:
      conversationsLoading,
    messagesLoading,
    olderMessagesLoading,
    syncing,
    error,
  } = useConversations(
    user?.id
  );

  const [replyMessage, setReplyMessage] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [pinsRevision, setPinsRevision] = useState(0);
  const [notificationsRevision, setNotificationsRevision] = useState(0);
  const [archiveRevision, setArchiveRevision] = useState(0);
  const [friendRequestsRevision, setFriendRequestsRevision] = useState(0);
  const [groupInvites, setGroupInvites] = useState([]);
  const [groupInviteToast, setGroupInviteToast] = useState(null);
  const [recentlyAddedConversationId, setRecentlyAddedConversationId] = useState(null);
  const [showRoomMenu, setShowRoomMenu] = useState(false);
  const [roomActionError, setRoomActionError] = useState("");
  const [roomDialog, setRoomDialog] = useState(null);
  const [roomActionPending, setRoomActionPending] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const roomMenuRef = useRef(null);
  const closeRoomMenu = useCallback(() => setShowRoomMenu(false), []);
  useClickOutside(roomMenuRef, closeRoomMenu, showRoomMenu);
  const [showMembers, setShowMembers] = useState(false);
  const memberListRef = useRef(null);
  const closeMembers = useCallback(() => setShowMembers(false), []);
  useClickOutside(memberListRef, closeMembers, showMembers);

  const handleSelectConversation = (conversationId) => {
    setReplyMessage(null);
    setShowPinnedMessages(false);
    setShowRoomMenu(false);
    setShowMembers(false);
    setRecentlyAddedConversationId((current) => current === conversationId ? null : current);
    setGroupInvites((current) => current.filter((invite) => invite.id !== conversationId));
    selectConversation(conversationId);
  };

  const handleSearchResult = (message) => {
    handleSelectConversation(message.conversationId);
  };

  const handleTogglePin = async (messageId) => {
    const updated = await toggleMessagePin(messageId);
    if (updated) setPinsRevision((revision) => revision + 1);
  };

  const refreshAfterMemberChange = async (action) => {
    try {
      setRoomActionError("");
      await action();
      await resync();
    } catch (requestError) {
      setRoomActionError(requestError.message);
      throw requestError;
    }
  };

  const handleToggleNotifications = async () => {
    if (!selectedConversation || !currentMembership) return;
    try {
      const membership = await updateNotificationPreferences(
        selectedConversation.id,
        !currentMembership.notificationsMuted
      );
      receiveMembershipUpdate(membership);
    } catch (requestError) {
      setRoomActionError(requestError.message);
    }
  };

  const handleArchiveConversation = async () => {
    if (!selectedConversation) return;
    try {
      await setConversationArchived(selectedConversation.id, true);
      handleSelectConversation(null);
      setArchiveRevision((revision) => revision + 1);
      await resync();
    } catch (requestError) {
      setRoomActionError(requestError.message);
    }
  };

  const {
    setInitialPresence,
    setUserOnline,
    setUserOffline,
    isUserOnline,
  } = usePresence();

  const handleWebSocketEvent =
    useCallback(
      (event) => {
        switch (event.type) {
          case "connection_ready":
            setInitialPresence(
              event.data
                .onlineUserIds
            );
            break;

          case "message_created":
            receiveMessage(
              event.data.message
            );
            break;

          case "message_updated":
            receiveMessageUpdate(
              event.data.message
            );
            break;

          case "message_deleted":
            receiveMessageDelete(
              event.data.message
            );
            break;

          case "mention_notification":
            setNotificationsRevision((revision) => revision + 1);
            break;

          case "friend_request_received":
          case "friend_relationship_updated":
            setFriendRequestsRevision((revision) => revision + 1);
            break;

          case "friend_request_accepted":
            setFriendRequestsRevision((revision) => revision + 1);
            setNotificationsRevision((revision) => revision + 1);
            window.dispatchEvent(new CustomEvent("friendship-toast", {
              detail: { message: `You and ${event.data.user?.name ?? "your new friend"} are now friends`, tone: "success" },
            }));
            break;

          case "conversation_read":
            receiveReadReceipt(event.data);
            break;

          case "conversation_added":
            receiveConversation(
              event.data
                .conversation
            );
            if (event.data.conversation.type !== "DIRECT") {
              setGroupInvites((current) => current.some((invite) => invite.id === event.data.conversation.id)
                ? current
                : [...current, event.data.conversation]);
              setRecentlyAddedConversationId(event.data.conversation.id);
              setGroupInviteToast(`You were added to ${event.data.conversation.name}`);
              window.setTimeout(() => setGroupInviteToast(null), 3200);
            }
            break;

          case "conversation_deleted":
            receiveConversationDelete(event.data.conversationId);
            break;

          case "typing_started":
            startTyping(
              event.data
                .conversationId,
              event.data.userId
            );
            break;

          case "typing_stopped":
            stopTyping(
              event.data
                .conversationId,
              event.data.userId
            );
            break;

          case "user_online":
            setUserOnline(
              event.data.userId
            );
            break;

          case "user_offline":
            setUserOffline(
              event.data.userId
            );
            break;

          default:
            console.log(
              "Unhandled WebSocket event:",
              event
            );
        }
      },
      [
        receiveConversation,
        receiveConversationDelete,
        receiveMessage,
        receiveMessageUpdate,
        receiveMessageDelete,
        receiveReadReceipt,
        setInitialPresence,
        setUserOffline,
        setUserOnline,
        startTyping,
        stopTyping,
      ]
    );

  const {
    status:
      websocketStatus,
    sendEvent,
  } = useWebSocket(
    Boolean(user),
    handleWebSocketEvent,
    resync
  );

  const handleTypingStart =
    () => {
      if (
        !selectedConversationId
      ) {
        return;
      }

      sendEvent(
        "typing_started",
        {
          conversationId:
            selectedConversationId,
        }
      );
    };

  const handleTypingStop =
    () => {
      if (
        !selectedConversationId
      ) {
        return;
      }

      sendEvent(
        "typing_stopped",
        {
          conversationId:
            selectedConversationId,
        }
      );
    };

  if (authLoading) {
    return <p>Loading...</p>;
  }

  if (!user) {
    return (
      <LoginPage
        onLogin={login}
      />
    );
  }

  if (
    conversationsLoading
  ) {
    return (
      <p>
        Loading conversations...
      </p>
    );
  }

  if (
    error &&
    !selectedConversation
  ) {
    return (
      <div className="app-error">
        <p>{error}</p>
      </div>
    );
  }

  const typingNames =
    selectedConversation?.members
      .filter(
        (membership) =>
          selectedTypingUsers.includes(
            membership.user.id
          )
      )
      .map(
        (membership) =>
          membership.user.name
      ) || [];

  const currentMembership = selectedConversation?.members.find(
    (membership) => membership.userId === user.id
  );
  const isConversationAdmin = currentMembership?.role === "ADMIN";
  const isConversationCreator = selectedConversation?.createdById === user.id;
  const directMember = selectedConversation?.members.find(
    (membership) => membership.userId !== user.id
  );
  const selectedConversationName = selectedConversation?.type === "DIRECT"
    ? directMember?.user.name ?? selectedConversation.name
    : selectedConversation?.name;

  const showConnectionBanner =
    websocketStatus !==
      "connected" ||
    syncing;

  const connectionMessage =
    syncing
      ? "Syncing missed messages..."
      : websocketStatus ===
          "connecting"
        ? "Connecting to realtime..."
        : websocketStatus ===
            "reconnecting"
          ? "Realtime connection lost. Reconnecting..."
          : websocketStatus ===
              "disconnected"
            ? "Realtime disconnected"
            : "";

  const connectionClassName =
    syncing
      ? "connection-status connecting"
      : `connection-status ${websocketStatus}`;

  return (
    <div className={`app ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <ConversationList
        conversations={
          conversations
        }
        selectedConversationId={
          selectedConversationId
        }
        onSelectConversation={
          handleSelectConversation
        }
        onCreateConversation={
          createConversation
        }
        currentUserId={user.id}
        currentUser={user}
        onLogout={logout}
        onArchiveConversation={async (conversation) => {
          await setConversationArchived(conversation.id, true);
          if (selectedConversationId === conversation.id) handleSelectConversation(null);
          setArchiveRevision((revision) => revision + 1);
          await resync();
        }}
        onLeaveConversation={async (conversation) => {
          await removeConversationMember(conversation.id, user.id);
          if (selectedConversationId === conversation.id) handleSelectConversation(null);
          await resync();
        }}
        onDeleteConversation={async (conversation) => {
          await deleteConversation(conversation.id);
          receiveConversationDelete(conversation.id);
        }}
        onDirectConversationCreated={(conversation) => {
          receiveConversation(conversation);
          handleSelectConversation(conversation.id);
        }}
        friendRequestsRevision={friendRequestsRevision}
        recentlyAddedConversationId={recentlyAddedConversationId}
        onUserUpdated={async (updatedUser) => {
          updateUser(updatedUser);
          await resync();
        }}
      />

      <main className="chat">
        <div className="chat-tools">
          <button className="sidebar-toggle" type="button" aria-label={sidebarCollapsed ? "Show messages sidebar" : "Hide messages sidebar"} title={sidebarCollapsed ? "Show messages" : "Hide messages"} onClick={() => setSidebarCollapsed((current) => !current)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={sidebarCollapsed ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"}/></svg>
          </button>
          <MessageSearch onSelectResult={handleSearchResult} />
          <NotificationCenter
            revision={notificationsRevision}
            friendRequestsRevision={friendRequestsRevision}
            groupInvites={groupInvites}
            onSelect={(notification) => {
              handleSelectConversation(notification.conversationId);
            }}
            onSelectGroupInvite={(conversation) => handleSelectConversation(conversation.id)}
          />
          <ArchivedConversations
            revision={archiveRevision}
            onRestore={async () => {
              setArchiveRevision((revision) => revision + 1);
              await resync();
            }}
          />
        </div>
        {showConnectionBanner && (
          <div
            className={
              connectionClassName
            }
          >
            {
              connectionMessage
            }
          </div>
        )}

        {selectedConversation ? (
          <>
            <div className="chat-header">
              <div className="chat-identity">
                <Avatar
                  user={selectedConversation.type === "DIRECT" ? directMember?.user : null}
                  name={selectedConversationName}
                  online={selectedConversation.type === "DIRECT" && isUserOnline(directMember?.user.id)}
                />
                <div>
                <h2>
                  {selectedConversationName}
                </h2>
                {selectedConversation.type === "DIRECT" ? (
                  <p className="chat-subtitle">{isUserOnline(directMember?.user.id) ? "Online" : "Offline"}</p>
                ) : (
                  <div className="member-summary" ref={memberListRef}>
                    <button type="button" className="chat-subtitle" aria-expanded={showMembers} onClick={() => setShowMembers((current) => !current)}>
                      {selectedConversation.members.length} {selectedConversation.members.length === 1 ? "member" : "members"}
                      <span aria-hidden="true">⌄</span>
                    </button>
                    {showMembers && (
                      <div className="member-summary-popover">
                        <strong>People</strong>
                        {selectedConversation.members.map((membership) => (
                          <div className="member-summary-person" key={membership.userId}>
                            <Avatar user={membership.user} size="small" online={isUserOnline(membership.user.id)} />
                            <span><strong>{membership.user.name}{membership.userId === user.id ? " (You)" : ""}</strong><small>{membership.role === "ADMIN" ? "Admin" : "Member"}</small></span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                </div>
              </div>

              {isConversationCreator && selectedConversation.type !== "DIRECT" && (
                <AddMember
                  conversationId={selectedConversation.id}
                  onMemberAdded={addMemberToConversation}
                  memberIds={selectedConversation.members.map((membership) => membership.userId)}
                />
              )}
              <div className="room-menu" ref={roomMenuRef}>
                <button className="room-menu-trigger" type="button" aria-label="Conversation options" aria-expanded={showRoomMenu} onClick={() => setShowRoomMenu((current) => !current)}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg></button>
                {showRoomMenu && (
                  <div className="room-menu-popover">
                    <button type="button" onClick={() => { setShowPinnedMessages(true); setShowRoomMenu(false); }}>Pinned messages</button>
                    <button type="button" onClick={() => { handleToggleNotifications(); setShowRoomMenu(false); }}>{currentMembership.notificationsMuted ? "Turn on notifications" : "Mute notifications"}</button>
                    {isConversationAdmin && selectedConversation.type !== "DIRECT" && <button type="button" onClick={() => {
                      setRenameValue(selectedConversation.name);
                      setRoomActionError("");
                      setRoomDialog({ type: "rename", conversation: selectedConversation });
                      setShowRoomMenu(false);
                    }}>Rename conversation</button>}
                    {isConversationAdmin && selectedConversation.type !== "DIRECT" && <div className="room-members">
                      <span>People</span>
                      {selectedConversation.members.filter((membership) => membership.userId !== user.id).map((membership) => <div key={membership.userId}>
                        <span>{membership.user.name}{membership.role === "ADMIN" ? " · Admin" : ""}</span>
                        <button type="button" onClick={() => refreshAfterMemberChange(() => updateConversationMemberRole(selectedConversation.id, membership.userId, membership.role === "ADMIN" ? "MEMBER" : "ADMIN"))}>{membership.role === "ADMIN" ? "Make member" : "Make admin"}</button>
                        <button className="danger-action" type="button" onClick={() => {
                          setRoomActionError("");
                          setRoomDialog({ type: "remove", conversation: selectedConversation, membership });
                          setShowRoomMenu(false);
                        }}>Remove</button>
                      </div>)}
                    </div>}
                    <button type="button" onClick={() => { handleArchiveConversation(); setShowRoomMenu(false); }}>Archive conversation</button>
                    {selectedConversation.type !== "DIRECT" && <button className="danger-action" type="button" onClick={() => {
                      setRoomActionError("");
                      setRoomDialog({ type: "leave", conversation: selectedConversation });
                      setShowRoomMenu(false);
                    }}>Leave conversation</button>}
                    {isConversationCreator && selectedConversation.type !== "DIRECT" && <button className="danger-action" type="button" onClick={() => {
                      setRoomActionError("");
                      setRoomDialog({ type: "delete", conversation: selectedConversation });
                      setShowRoomMenu(false);
                    }}>Delete group</button>}
                    {selectedConversation.type === "DIRECT" && <button className="danger-action" type="button" onClick={() => {
                      setRoomActionError("");
                      setRoomDialog({ type: "delete", conversation: selectedConversation });
                      setShowRoomMenu(false);
                    }}>Delete conversation</button>}
                  </div>
                )}
              </div>
            </div>

            {roomActionError && !roomDialog && <div className="app-toast app-toast-error" role="status"><span>{roomActionError}</span><button type="button" aria-label="Dismiss" onClick={() => setRoomActionError("")}>×</button></div>}

            {roomDialog && <div className="delete-group-backdrop" onPointerDown={(event) => {
              if (event.target === event.currentTarget && !roomActionPending) setRoomDialog(null);
            }}>
              <form className="delete-group-modal" role="dialog" aria-modal="true" onSubmit={async (event) => {
                event.preventDefault();
                try {
                  setRoomActionPending(true);
                  setRoomActionError("");
                  if (roomDialog.type === "rename") {
                    const nextName = renameValue.trim();
                    if (!nextName) return;
                    await refreshAfterMemberChange(() => renameConversation(roomDialog.conversation.id, nextName));
                  } else if (roomDialog.type === "remove") {
                    await refreshAfterMemberChange(() => removeConversationMember(roomDialog.conversation.id, roomDialog.membership.userId));
                  } else if (roomDialog.type === "leave") {
                    await removeConversationMember(roomDialog.conversation.id, user.id);
                    handleSelectConversation(null);
                    await resync();
                  } else {
                    await deleteConversation(roomDialog.conversation.id);
                    receiveConversationDelete(roomDialog.conversation.id);
                  }
                  setRoomDialog(null);
                } catch (requestError) {
                  setRoomActionError(requestError.message || "That action could not be completed.");
                } finally {
                  setRoomActionPending(false);
                }
              }}>
                <div className={roomDialog.type === "rename" ? "rename-dialog-icon" : "delete-warning-icon"}>{roomDialog.type === "rename" ? "✎" : "!"}</div>
                <h2>{roomDialog.type === "rename" ? "Rename group" : roomDialog.type === "remove" ? `Remove ${roomDialog.membership.user.name}?` : roomDialog.type === "delete" ? `Delete ${roomDialog.conversation.type === "DIRECT" ? "conversation" : `“${roomDialog.conversation.name}”`}?` : `Leave “${roomDialog.conversation.name}”?`}</h2>
                {roomDialog.type === "rename" ? <input className="dialog-input" value={renameValue} maxLength={100} autoFocus onChange={(event) => setRenameValue(event.target.value)} /> : <p>{roomDialog.type === "remove" ? "They’ll no longer have access to this group or its new messages." : roomDialog.type === "delete" ? `This permanently deletes the ${roomDialog.conversation.type === "DIRECT" ? "conversation for both people" : "group and its message history for everyone"}. This can’t be undone.` : "You’ll stop receiving messages from this group."}</p>}
                {roomActionError && <p className="dialog-error">{roomActionError}</p>}
                <div>
                  <button type="button" disabled={roomActionPending} onClick={() => setRoomDialog(null)}>Cancel</button>
                  <button className={roomDialog.type === "rename" ? "primary-action" : "danger-action"} type="submit" disabled={roomActionPending || (roomDialog.type === "rename" && !renameValue.trim())}>{roomActionPending ? "Working…" : roomDialog.type === "rename" ? "Save" : roomDialog.type === "remove" ? "Remove" : roomDialog.type === "delete" ? roomDialog.conversation.type === "DIRECT" ? "Delete conversation" : "Delete for everyone" : "Leave group"}</button>
                </div>
              </form>
            </div>}

            {messagesLoading ? (
              <p>
                Loading messages...
              </p>
            ) : (
              <MessageList
                key={`messages:${selectedConversation.id}`}
                messages={
                  selectedConversation.messages
                }
                currentUser={
                  user
                }
                members={selectedConversation.members}
                showSenderNames={
                  selectedConversation.type !== "DIRECT"
                }
                hasMoreMessages={
                  selectedConversation.hasMoreMessages
                }
                onLoadOlderMessages={
                  loadOlderMessages
                }
                olderMessagesLoading={
                  olderMessagesLoading
                }
                onEditMessage={
                  editMessage
                }
                onDeleteMessage={
                  deleteMessage
                }
                onReply={setReplyMessage}
                onTogglePin={handleTogglePin}
                onRetryMessage={retryMessage}
              />
            )}

            <div className="typing-indicator">
              {typingNames.length >
                0 && (
                <span>
                  {typingNames.join(
                    ", "
                  )}{" "}
                  {typingNames.length ===
                  1
                    ? "is"
                    : "are"}{" "}
                  typing...
                </span>
              )}
            </div>

            <MessageInput
              conversationId={selectedConversation.id}
              key={`conversation:${selectedConversation.id}`}
              draftKey={`conversation:${selectedConversation.id}`}
              onSendMessage={
                sendMessage
              }
              onTypingStart={
                handleTypingStart
              }
              onTypingStop={
                handleTypingStop
              }
              replyToMessage={replyMessage}
              onCancelReply={() => setReplyMessage(null)}
            />
            {showPinnedMessages && (
              <PinnedMessages
                conversationId={selectedConversation.id}
                revision={pinsRevision}
                onClose={() => setShowPinnedMessages(false)}
                onSelect={() => {
                  setShowPinnedMessages(false);
                }}
              />
            )}
          </>
        ) : (
          <div className="empty-chat">
            <p>
              Create a
              conversation to
              start messaging.
            </p>
          </div>
        )}
      </main>
      {groupInviteToast && <div className="group-invite-toast" role="status"><span>New group</span>{groupInviteToast}</div>}
    </div>
  );
}

export default App;
