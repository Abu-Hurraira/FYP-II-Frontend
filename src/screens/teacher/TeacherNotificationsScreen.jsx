import React, { useCallback, useContext, useEffect, useState } from "react";
import { getUserNotifications, markAllNotificationsRead, markNotificationRead } from "../../api/notificationsApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import theme from "../../styles/theme";
import { showAlert } from "../../utils/dialogs";
import { getAuthUserId } from "../../utils/helpers";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export default function TeacherNotificationsScreen() {
  const { user } = useContext(AuthContext);
  const userId = getAuthUserId(user);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getUserNotifications(userId);
      setNotifications(data || []);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = async (notification) => {
    if (notification.isRead) return;
    try {
      await markNotificationRead(notification.notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.notificationId === notification.notificationId ? { ...n, isRead: true } : n
        )
      );
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const handleMarkAllRead = async () => {
    if (!userId) return;
    try {
      await markAllNotificationsRead(userId);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {user?.fullName || user?.name || "Teacher"}
            {unreadCount > 0 ? ` · ${unreadCount} unread` : ""}
          </p>
        </div>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Mark all read
          </button>
        ) : null}
      </div>

      <div className="w-full px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : notifications.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">No notifications yet.</p>
        ) : (
          <div className="space-y-2.5">
            {notifications.map((item) => (
              <button
                key={item.notificationId}
                type="button"
                onClick={() => handleMarkRead(item)}
                className={`w-full rounded-lg border px-4 py-3 text-left shadow-sm transition ${
                  item.isRead
                    ? "border-gray-200 bg-white"
                    : "border-brand/30 bg-brand-light/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-900">{item.title || "Notification"}</p>
                  {!item.isRead ? (
                    <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">
                      New
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{item.message}</p>
                {item.createdAt ? (
                  <p className="mt-2 text-xs text-gray-400">{formatDate(item.createdAt)}</p>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
