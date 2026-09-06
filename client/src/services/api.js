const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3001";

export async function getServerHealth() {
  const response = await fetch(
    `${API_URL}/health`
  );

  if (!response.ok) {
    throw new Error(
      "Failed to get server health"
    );
  }

  return response.json();
}

export async function getCurrentUser() {
  const response = await fetch(
    `${API_URL}/auth/me`,
    {
      credentials: "include",
    }
  );

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      "Failed to get current user"
    );
  }

  return response.json();
}

export async function loginWithGoogle(
  credential
) {
  const response = await fetch(
    `${API_URL}/auth/google`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        credential,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      "Failed to log in with Google"
    );
  }

  return response.json();
}

export async function logoutUser() {
  const response = await fetch(
    `${API_URL}/auth/logout`,
    {
      method: "POST",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(
      "Failed to log out"
    );
  }

  return response.json();
}

export async function searchUsers(
  search
) {
  const params =
    new URLSearchParams({
      search,
    });

  const response = await fetch(
    `${API_URL}/users?${params}`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(
      "Failed to search users"
    );
  }

  return response.json();
}

export async function getConversations() {
  const response = await fetch(
    `${API_URL}/conversations`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(
      "Failed to load conversations"
    );
  }

  return response.json();
}

export async function createConversation(
  name
) {
  const response = await fetch(
    `${API_URL}/conversations`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        name,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      "Failed to create conversation"
    );
  }

  return response.json();
}

export async function addConversationMember(
  conversationId,
  userId
) {
  const response = await fetch(
    `${API_URL}/conversations/${conversationId}/members`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        userId,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      "Failed to add member"
    );
  }

  return response.json();
}

export async function getMessages(
  conversationId,
  before = null
) {
  const params =
    new URLSearchParams();

  if (before) {
    params.set(
      "before",
      before
    );
  }

  const query =
    params.toString();

  const url = query
    ? `${API_URL}/conversations/${conversationId}/messages?${query}`
    : `${API_URL}/conversations/${conversationId}/messages`;

  const response = await fetch(
    url,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(
      "Failed to load messages"
    );
  }

  return response.json();
}

export async function sendMessage(
  conversationId,
  message
) {
  const response = await fetch(
    `${API_URL}/conversations/${conversationId}/messages`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(
        message
      ),
    }
  );

  if (!response.ok) {
    throw new Error(
      "Failed to send message"
    );
  }

  return response.json();
}

export async function updateMessage(
  conversationId,
  messageId,
  text
) {
  const response = await fetch(
    `${API_URL}/conversations/${conversationId}/messages/${messageId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        text,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      "Failed to update message"
    );
  }

  return response.json();
}

export async function deleteMessage(
  conversationId,
  messageId
) {
  const response = await fetch(
    `${API_URL}/conversations/${conversationId}/messages/${messageId}`,
    {
      method: "DELETE",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(
      "Failed to delete message"
    );
  }

  return response.json();
}

export async function toggleMessageReaction(
  conversationId,
  messageId,
  emoji
) {
  const response = await fetch(
    `${API_URL}/conversations/${conversationId}/messages/${messageId}/reactions`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to update reaction");
  }

  return response.json();
}

export async function getMessageThread(conversationId, messageId) {
  const response = await fetch(
    `${API_URL}/conversations/${conversationId}/messages/${messageId}/thread`,
    { credentials: "include" }
  );
  if (!response.ok) throw new Error("Failed to load thread");
  return response.json();
}

export async function searchMessages(query) {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`${API_URL}/search/messages?${params}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to search messages");
  return response.json();
}

export async function getPinnedMessages(conversationId) {
  const response = await fetch(`${API_URL}/conversations/${conversationId}/pins`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to load pinned messages");
  return response.json();
}

export async function toggleMessagePin(conversationId, messageId) {
  const response = await fetch(`${API_URL}/conversations/${conversationId}/messages/${messageId}/pin`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to update pin");
  return response.json();
}

export async function getNotifications() {
  const response = await fetch(`${API_URL}/notifications`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to load notifications");
  return response.json();
}

export async function markNotificationsRead() {
  const response = await fetch(`${API_URL}/notifications/read`, { method: "PATCH", credentials: "include" });
  if (!response.ok) throw new Error("Failed to mark notifications read");
  return response.json();
}

export async function markConversationRead(
  conversationId,
  messageId
) {
  const response = await fetch(
    `${API_URL}/conversations/${conversationId}/read`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        messageId,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      "Failed to mark conversation read"
    );
  }

  return response.json();
}
