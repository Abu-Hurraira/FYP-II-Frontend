import React, { useContext } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import LoggedInUserBar from "../components/LoggedInUserBar.jsx";
import { getAuthDisplayName, getAuthRoleLabel } from "../utils/helpers";

const navItem =
  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-brand-muted/80";

const navActive = "bg-brand-light text-brand shadow-sm";

function SidebarIconDashboard({ active }) {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function SidebarIconAttendance() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function SidebarIconBell() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

function SidebarIconUser() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

export default function TeacherLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const displayName = getAuthDisplayName(user, "Teacher");
  const roleLabel = getAuthRoleLabel(user, "Teacher");

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white">
            <span className="text-lg font-bold">F</span>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Folder Management</p>
            <p className="text-xs font-medium text-gray-500">System</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-6">
          <NavLink
            to="/teacher"
            end
            className={({ isActive }) => `${navItem} ${isActive ? navActive : ""}`}
          >
            <SidebarIconDashboard />
            Dashboard
          </NavLink>
          <NavLink
            to="/teacher/placeholder?title=Attendance"
            className={({ isActive }) => `${navItem} ${isActive ? navActive : ""}`}
          >
            <SidebarIconAttendance />
            Attendance
          </NavLink>
          <NavLink
            to="/teacher/notifications"
            className={({ isActive }) => `${navItem} ${isActive ? navActive : ""}`}
          >
            <SidebarIconBell />
            Notifications
          </NavLink>
          <NavLink
            to="/teacher/profile"
            className={({ isActive }) => `${navItem} ${isActive ? navActive : ""}`}
          >
            <SidebarIconUser />
            Profile
          </NavLink>

          <div className="my-4 border-t border-gray-100" />

          <NavLink
            to="/teacher/submit-folders"
            className={({ isActive }) =>
              `${navItem} ${isActive ? "bg-gray-100 font-bold text-gray-900" : ""}`
            }
          >
            <span className="text-lg">➤</span>
            Submit folders
          </NavLink>
        </nav>

        <div className="border-t border-gray-100 p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white">
              <SidebarIconUser />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-gray-900">{displayName}</p>
              <p className="truncate text-xs text-gray-500">{roleLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      <main className="min-h-screen w-full min-w-0 flex-1 overflow-auto">
        <LoggedInUserBar roleFallback="Teacher" />
        <Outlet />
      </main>
    </div>
  );
}
