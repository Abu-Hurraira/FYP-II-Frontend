import request from "./apiClient";

function normalizeNotification(raw) {
  if (!raw || typeof raw !== "object") return raw;
  return {
    notificationId: raw.notificationId ?? raw.NotificationId,
    userId: raw.userId ?? raw.UserId,
    title: raw.notificationTitle ?? raw.NotificationTitle ?? raw.title ?? "",
    message: raw.notificationMessage ?? raw.NotificationMessage ?? raw.message ?? "",
    type: raw.notificationType ?? raw.NotificationType ?? raw.type ?? "",
    relatedId: raw.relatedId ?? raw.RelatedId ?? null,
    isRead: Boolean(raw.isRead ?? raw.IsRead),
    createdAt: raw.createdAt ?? raw.CreatedAt ?? null,
  };
}

export async function getUserNotifications(userId) {
  const data = await request(`/Notifications/user/${userId}`);
  const list = Array.isArray(data) ? data : data?.notifications ?? data?.Notifications ?? [];
  return list.map(normalizeNotification);
}

export async function markNotificationRead(notificationId) {
  return await request(`/Notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

export async function markAllNotificationsRead(userId) {
  return await request(`/Notifications/user/${userId}/read-all`, {
    method: "PATCH",
  });
}
