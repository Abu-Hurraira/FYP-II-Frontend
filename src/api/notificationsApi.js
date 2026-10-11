import request from "./apiClient";
import { asList } from "../utils/helpers";

function notificationTypeLabel(type) {
  switch (String(type || "")) {
    case "CLOs":
      return "CLO approval";
    case "WeeklyContent":
      return "Weekly content approval";
    case "CloPloMapping":
      return "CLO-PLO mapping approval";
    case "CloTaskMapping":
      return "CLO-Task mapping approval";
    case "CourseFolder":
      return "Folder review";
    default:
      return type || "";
  }
}

function normalizeNotification(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const type = raw.notificationType ?? raw.NotificationType ?? raw.type ?? "";
  return {
    notificationId: raw.notificationId ?? raw.NotificationId,
    userId: raw.userId ?? raw.UserId,
    title: raw.notificationTitle ?? raw.NotificationTitle ?? raw.title ?? "",
    message: raw.notificationMessage ?? raw.NotificationMessage ?? raw.message ?? "",
    type,
    typeLabel: raw.typeLabel ?? raw.TypeLabel ?? notificationTypeLabel(type),
    relatedId: raw.relatedId ?? raw.RelatedId ?? null,
    isRead: Boolean(raw.isRead ?? raw.IsRead),
    createdAt: raw.createdAt ?? raw.CreatedAt ?? null,
  };
}

export async function getUserNotifications(userId) {
  const data = await request(`/Notifications/user/${userId}`);
  return dedupeNotifications(asList(data).map(normalizeNotification));
}

function dedupeNotifications(list) {
  const seen = new Map();
  for (const item of list) {
    const key =
      item.relatedId != null && item.relatedId !== ""
        ? `${String(item.type || "").toLowerCase()}|${item.relatedId}`
        : `id|${item.notificationId}`;
    const previous = seen.get(key);
    if (!previous) {
      seen.set(key, item);
      continue;
    }
    const newer =
      new Date(item.createdAt || 0).getTime() >= new Date(previous.createdAt || 0).getTime()
        ? item
        : previous;
    if (!previous.isRead && newer.isRead) {
      seen.set(key, { ...newer, isRead: false });
    } else {
      seen.set(key, newer);
    }
  }
  return [...seen.values()].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
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
