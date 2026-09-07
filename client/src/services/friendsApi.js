import { API_URL } from "./apiClient";

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
