import React, { useCallback, useContext, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import { getUserNotifications } from "../api/notificationsApi";
import { getAuthDisplayName, getAuthUserId } from "../utils/helpers";
import ThemeToggle from "./ThemeToggle.jsx";

function BellIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

/**
 * Top bar: theme toggle, optional notifications bell, profile avatar.
 */
export default function LoggedInUserBar({
  roleFallback = "User",
  profilePath,
  notificationsPath = null,
  leading = null,
  onMenuClick = null,
}) {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const displayName = getAuthDisplayName(user, roleFallback);
  const userId = getAuthUserId(user);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnread = useCallback(async () => {
    if (!notificationsPath || !userId) {
      setUnreadCount(0);
      return;
    }
    try {
      const data = await getUserNotifications(userId);
      setUnreadCount((data || []).filter((n) => !n.isRead).length);
    } catch {
      // Bell badge is best-effort; avoid toast spam if API is briefly unavailable.
      setUnreadCount(0);
    }
  }, [notificationsPath, userId]);

  useEffect(() => {
    loadUnread();
    if (!notificationsPath || !userId) return undefined;
    const timer = window.setInterval(loadUnread, 20000);
    const onFocus = () => loadUnread();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadUnread, location.pathname, notificationsPath, userId]);

  const initial = displayName.charAt(0).toUpperCase() || "U";

  return (
    <div className={`app-header-bar ${leading || onMenuClick ? "!justify-between gap-2 sm:gap-3" : ""}`}>
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-700 transition hover:bg-brand-muted hover:text-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 lg:hidden dark:text-gray-200"
            aria-label="Open navigation menu"
            title="Open menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        {leading}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
      <ThemeToggle />

      {notificationsPath ? (
        <Link
          to={notificationsPath}
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#1a6b45] transition hover:bg-brand-muted"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          title="Notifications"
        >
          <BellIcon />
          {unreadCount > 0 ? (
            <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
          ) : null}
        </Link>
      ) : null}

      {profilePath ? (
        <Link
          to={profilePath}
          className="app-header-avatar transition hover:bg-brand-muted"
          aria-label="Profile"
          title="Profile"
        >
          {initial}
        </Link>
      ) : (
        <div className="app-header-avatar">{initial}</div>
      )}
      </div>
    </div>
  );
}
