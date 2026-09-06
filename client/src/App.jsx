import {
  useCallback,
  useEffect,
  useState,
} from "react";

import AddMember from "./components/AddMember";
import ConversationList from "./components/ConversationList";
import MessageList from "./components/MessageList";
import MessageInput from "./components/MessageInput";
import LoginPage from "./pages/LoginPage";

import useAuth from "./hooks/useAuth";
import useConversations from "./hooks/useConversations";
import usePresence from "./hooks/usePresence";
import useWebSocket from "./hooks/useWebSocket";

import {
  getServerHealth,
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
    loadOlderMessages,
    startTyping,
    stopTyping,
    sendMessage,
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
          selectConversation
        }
        onCreateConversation={
          createConversation
        }
      />

      <main className="chat">
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
                      </span>
                    )
                  )}
                </div>
              </div>

              <AddMember
                conversationId={
                  selectedConversation.id
                }
                onMemberAdded={
                  addMemberToConversation
                }
              />
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