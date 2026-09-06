import { useState } from "react";

function ConversationList({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onCreateConversation,
  currentUserId,
}) {
  const [name, setName] =
    useState("");

  const [showForm, setShowForm] =
    useState(false);

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

  return (
    <aside className="sidebar">
      <div className="conversation-header">
        <h2>Conversations</h2>

        <button
          type="button"
          onClick={() =>
            setShowForm(
              (current) => !current
            )
          }
        >
          + New
        </button>
      </div>

      {showForm && (
        <form
          className="conversation-form"
          onSubmit={handleSubmit}
        >
          <input
            type="text"
            value={name}
            onChange={(event) =>
              setName(
                event.target.value
              )
            }
            placeholder="Conversation name"
            autoFocus
          />

          <button type="submit">
            Create
          </button>
        </form>
      )}

      <div className="conversation-list">
        {conversations.map(
          (conversation) => (
            <button
              key={conversation.id}
              className={
                conversation.id ===
                selectedConversationId
                  ? "conversation active"
                  : "conversation"
              }
              onClick={() =>
                onSelectConversation(
                  conversation.id
                )
              }
            >
              <div>
                {conversation.name}

                {conversation.members.find((membership) => membership.userId === currentUserId)?.notificationsMuted && (
                  <span className="conversation-muted" title="Notifications muted"> · Muted</span>
                )}

                {conversation.unreadCount >
                  0 &&
                  ` (${conversation.unreadCount})`}
              </div>

              {conversation.lastMessage && (
                <div>
                  {
                    conversation
                      .lastMessage
                      .sender?.name
                  }
                  :{" "}
                  {
                    conversation
                      .lastMessage.text
                  }
                </div>
              )}
            </button>
          )
        )}
      </div>
    </aside>
  );
}

export default ConversationList;
