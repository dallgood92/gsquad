const API_URL = "http://localhost:3001";

/* ================================
   Server Health
================================ */

export async function getServerHealth() {
  const response = await fetch(`${API_URL}/health`);

  if (!response.ok) {
    throw new Error("Failed to connect to server");
  }

  return response.json();
}

/* ================================
   Authentication
================================ */

export async function loginWithGoogle(credential) {
  const response = await fetch(`${API_URL}/auth/google`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      credential,
    }),
  });

  if (!response.ok) {
    throw new Error("Google login failed");
  }

  return response.json();
}

export async function getCurrentUser() {
  const response = await fetch(`${API_URL}/auth/me`, {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to get current user");
  }

  const data = await response.json();

  return data.user;
}

export async function logoutUser() {
  const response = await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to logout");
  }

  return response.json();
}

/* ================================
   Users
================================ */

export async function searchUsers(search) {
  const response = await fetch(
    `${API_URL}/users?search=${encodeURIComponent(search)}`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to search users");
  }

  return response.json();
}

/* ================================
   Conversations
================================ */

export async function getConversations() {
  const response = await fetch(`${API_URL}/conversations`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to load conversations");
  }

  return response.json();
}

export async function createConversation(name) {
  const response = await fetch(`${API_URL}/conversations`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create conversation");
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
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
      }),
    }
  );

  if (!response.ok) {
    const data = await response.json();

    throw new Error(
      data.error || "Failed to add conversation member"
    );
  }

  return response.json();
}

/* ================================
   Messages
================================ */

export async function getMessages(conversationId) {
  const response = await fetch(
    `${API_URL}/conversations/${conversationId}/messages`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to load messages");
  }

  return response.json();
}

export async function sendMessage(conversationId, message) {
  const response = await fetch(
    `${API_URL}/conversations/${conversationId}/messages`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to send message");
  }

  return response.json();
}