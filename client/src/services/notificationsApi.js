import { API_URL } from "./apiClient";

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
