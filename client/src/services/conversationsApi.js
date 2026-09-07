import { API_URL } from "./apiClient";

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

export async function createDirectConversation(userId) {
  const response = await fetch(`${API_URL}/conversations/direct`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Failed to start direct message");
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

export async function renameConversation(conversationId, name) {
  const response = await fetch(`${API_URL}/conversations/${conversationId}`, {
    method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error("Failed to rename conversation");
  return response.json();
}

export async function deleteConversation(conversationId) {
  const response = await fetch(`${API_URL}/conversations/${conversationId}/delete`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Failed to delete conversation");
  }
  return response.json();
}

export async function removeConversationMember(conversationId, userId) {
  const response = await fetch(`${API_URL}/conversations/${conversationId}/members/${userId}`, {
    method: "DELETE", credentials: "include",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Failed to leave group");
  }
  return response.json();
}

export async function updateConversationMemberRole(conversationId, userId, role) {
  const response = await fetch(`${API_URL}/conversations/${conversationId}/members/${userId}/role`, {
    method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }),
  });
  if (!response.ok) throw new Error("Failed to update member role");
  return response.json();
}

export async function updateNotificationPreferences(conversationId, notificationsMuted) {
  const response = await fetch(`${API_URL}/conversations/${conversationId}/notification-preferences`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notificationsMuted }),
  });
  if (!response.ok) throw new Error("Failed to update notification preferences");
  return response.json();
}

export async function getArchivedConversations() {
  const response = await fetch(`${API_URL}/conversations/archived`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to load archived conversations");
  return response.json();
}

export async function setConversationArchived(conversationId, archived) {
  const response = await fetch(`${API_URL}/conversations/${conversationId}/archive`, {
    method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived }),
  });
  if (!response.ok) throw new Error("Failed to update conversation archive");
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
