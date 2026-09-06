import {
  useCallback,
  useEffect,
  useState,
} from "react";

import AddMember from "./components/AddMember";
import ConversationList from "./components/ConversationList";
import MessageList from "./components/MessageList";
import MessageSearch from "./components/MessageSearch";
import MessageInput from "./components/MessageInput";
import ThreadPanel from "./components/ThreadPanel";
import PinnedMessages from "./components/PinnedMessages";
import NotificationCenter from "./components/NotificationCenter";
import LoginPage from "./pages/LoginPage";

import useAuth from "./hooks/useAuth";
import useConversations from "./hooks/useConversations";
import usePresence from "./hooks/usePresence";
import useWebSocket from "./hooks/useWebSocket";

import {
  getServerHealth,
  renameConversation,
  removeConversationMember,
  updateConversationMemberRole,
} from "./services/api";

function App() {
  const [
    serverStatus,
    setServerStatus,
  ] = useState("checking");

  const {
    user,
    loading: authLoading,
    login,
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
    receiveMessage,
    receiveMessageUpdate,
    receiveMessageDelete,
    editMessage,
    deleteMessage,
    toggleMessageReaction,
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

  const [threadMessage, setThreadMessage] = useState(null);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [pinsRevision, setPinsRevision] = useState(0);
  const [notificationsRevision, setNotificationsRevision] = useState(0);

  const handleSelectConversation = (conversationId) => {
    setThreadMessage(null);
    setShowPinnedMessages(false);
    selectConversation(conversationId);
  };

  const handleSearchResult = (message) => {
    handleSelectConversation(message.conversationId);
    if (message.replyToMessage) setThreadMessage(message.replyToMessage);
  };

  const handleTogglePin = async (messageId) => {
    const updated = await toggleMessagePin(messageId);
    if (updated) setPinsRevision((revision) => revision + 1);
  };

  const refreshAfterMemberChange = async (action) => {
    try {
      await action();
      await resync();
    } catch (requestError) {
      window.alert(requestError.message);
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

          case "conversation_added":
            receiveConversation(
              event.data
                .conversation
            );
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
        receiveMessage,
        receiveMessageUpdate,
        receiveMessageDelete,
        setInitialPresence,
        setUserOffline,
        setUserOnline,
        startTyping,
        stopTyping,
      ]
    );

  const {
    connected,
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

  useEffect(() => {
    async function checkServerHealth() {
      try {
        const data =
          await getServerHealth();

        setServerStatus(
          data.status
        );
      } catch (error) {
        console.error(
          "Failed to connect to server:",
          error
        );

        setServerStatus(
          "offline"
        );
      }
    }

    checkServerHealth();
  }, []);

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
      <div>
        <p>
          Server:{" "}
          {serverStatus}
        </p>

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
    <div className="app">
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
      />

      <main className="chat">
        <div className="chat-tools">
          <MessageSearch onSelectResult={handleSearchResult} />
          <NotificationCenter
            revision={notificationsRevision}
            onSelect={(notification) => {
              handleSelectConversation(notification.conversationId);
            }}
          />
        </div>
        <div>
          <p>
            Server:{" "}
            {serverStatus}
          </p>

          <p>
            Realtime:{" "}
            {connected
              ? "connected"
              : websocketStatus}
          </p>

          <p>
            Signed in as{" "}
            <strong>
              {user.name}
            </strong>
          </p>

          <button
            onClick={logout}
          >
            Logout
          </button>
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
              <div>
                <h2>
                  {
                    selectedConversation.name
                  }
                </h2>
                {isConversationAdmin && (
                  <button type="button" onClick={() => {
                    const name = window.prompt("Conversation name", selectedConversation.name)?.trim();
                    if (name && name !== selectedConversation.name) refreshAfterMemberChange(() => renameConversation(selectedConversation.id, name));
                  }}>Rename</button>
                )}

                <div className="member-list">
                  {selectedConversation.members.map(
                    (
                      membership
                    ) => (
                      <span
                        key={
                          membership.userId
                        }
                        className="member-status"
                      >
                        <span
                          className={
                            isUserOnline(
                              membership.user.id
                            )
                              ? "presence-dot online"
                              : "presence-dot"
                          }
                        />

                        {
                          membership.user.name
                        }
                        {membership.role === "ADMIN" && " · Admin"}
                        {isConversationAdmin && membership.userId !== user.id && (
                          <>
                            <button type="button" onClick={() => refreshAfterMemberChange(() => updateConversationMemberRole(selectedConversation.id, membership.userId, membership.role === "ADMIN" ? "MEMBER" : "ADMIN"))}>
                              {membership.role === "ADMIN" ? "Make member" : "Make admin"}
                            </button>
                            <button type="button" onClick={() => {
                              if (window.confirm(`Remove ${membership.user.name}?`)) refreshAfterMemberChange(() => removeConversationMember(selectedConversation.id, membership.userId));
                            }}>Remove</button>
                          </>
                        )}
                      </span>
                    )
                  )}
                </div>
              </div>

              {isConversationAdmin && (
                <AddMember
                  conversationId={selectedConversation.id}
                  onMemberAdded={addMemberToConversation}
                />
              )}
              <button type="button" onClick={() => {
                if (window.confirm("Leave this conversation?")) {
                  removeConversationMember(selectedConversation.id, user.id)
                    .then(() => { handleSelectConversation(null); return resync(); })
                    .catch((requestError) => window.alert(requestError.message));
                }
              }}>Leave</button>
              <button type="button" onClick={() => setShowPinnedMessages(true)}>
                Pinned messages
              </button>
            </div>

            {error && (
              <p>{error}</p>
            )}

            {messagesLoading ? (
              <p>
                Loading messages...
              </p>
            ) : (
              <MessageList
                messages={
                  selectedConversation.messages
                }
                currentUser={
                  user
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
                onToggleReaction={toggleMessageReaction}
                onReply={setThreadMessage}
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
            />
            {threadMessage && (
              <ThreadPanel
                key={`thread:${selectedConversation.id}:${threadMessage.id}`}
                conversationId={selectedConversation.id}
                rootMessage={threadMessage}
                liveMessages={selectedConversation.messages}
                onClose={() => setThreadMessage(null)}
                onSendMessage={sendMessage}
              />
            )}
            {showPinnedMessages && (
              <PinnedMessages
                conversationId={selectedConversation.id}
                revision={pinsRevision}
                onClose={() => setShowPinnedMessages(false)}
                onSelect={(message) => {
                  setShowPinnedMessages(false);
                  if (message.replyToMessage) setThreadMessage(message.replyToMessage);
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
    </div>
  );
}

export default App;
