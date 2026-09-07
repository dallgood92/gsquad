import { API_URL } from "./apiClient";

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
