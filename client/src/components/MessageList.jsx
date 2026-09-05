function MessageList({ messages, currentUser }) {
  return (
    <div className="message-list">
      {messages.map((message) => {
        const isOwnMessage = message.senderId === currentUser.id;

        return (
          <div
            key={message.id}
            className={`message ${
              isOwnMessage ? "message-own" : "message-other"
            }`}
          >
            <span className="message-sender">
              {message.sender.name}
            </span>

            <span className="message-text">
              {message.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default MessageList;