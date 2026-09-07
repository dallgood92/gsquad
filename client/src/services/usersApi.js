import { API_URL } from "./apiClient";

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
