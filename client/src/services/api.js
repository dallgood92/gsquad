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

export async function updateCurrentUser(name) {
  const response = await fetch(`${API_URL}/users/me`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Failed to update display name");
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

export async function getFriends() {
  const response = await fetch(`${API_URL}/friends`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to load friends");
  return response.json();
}

export async function getBlockedUsers() {
  const response = await fetch(`${API_URL}/friends/blocked`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to load blocked users");
  return response.json();
}

export async function blockUser(userId) {
  const response = await fetch(`${API_URL}/friends/${userId}/block`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Failed to block user");
  }
  return response.json();
}

export async function unblockUser(userId) {
  const response = await fetch(`${API_URL}/friends/${userId}/block`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to unblock user");
  return response.json();
}

export async function addFriend(friendId) {
  const response = await fetch(`${API_URL}/friends/${friendId}`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to add friend");
  return response.json();
}

export async function removeFriend(friendId) {
  const response = await fetch(`${API_URL}/friends/${friendId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to remove friend");
  return response.json();
}

export async function getFriendRequests() {
  const response = await fetch(`${API_URL}/friends/requests`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to load friend requests");
  return response.json();
}

export async function acceptFriendRequest(friendId) {
  const response = await fetch(`${API_URL}/friends/${friendId}/accept`, {
    method: "PATCH",
    credentials: "include",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Failed to accept friend request");
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
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Message could not be sent");
  }

  return response.json();
}

export async function uploadMessageAttachment(conversationId, file, metadata = {}, onProgress) {
  const response = await fetch(`${API_URL}/attachments/presign`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, originalName: file.name, mimeType: file.type, size: file.size }),
  });
  const upload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(upload?.error || "Attachment upload is unavailable");

  await new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", upload.uploadUrl);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("The attachment could not be uploaded"));
    request.onerror = () => reject(new Error("The attachment could not be uploaded"));
    request.send(file);
  });

  return {
    storageKey: upload.storageKey,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    duration: metadata.duration ?? null,
  };
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
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Failed to delete message");
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

export async function dismissNotification(notificationId) {
  const response = await fetch(`${API_URL}/notifications/${notificationId}`, { method: "DELETE", credentials: "include" });
  if (!response.ok) throw new Error("Failed to dismiss notification");
  return response.json();
}

export async function clearNotifications() {
  const response = await fetch(`${API_URL}/notifications`, { method: "DELETE", credentials: "include" });
  if (!response.ok) throw new Error("Failed to clear notifications");
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
