import { API_URL } from "./apiClient";

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
