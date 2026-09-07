import { API_URL } from "./apiClient";

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
