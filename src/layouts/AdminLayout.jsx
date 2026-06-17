import React, { useContext } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import LoggedInUserBar from "../components/LoggedInUserBar.jsx";
import { getAuthDisplayName, getAuthRoleLabel } from "../utils/helpers";

const navItem =
  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-brand-muted/80";
const navActive = "bg-brand-light text-brand shadow-sm";

function SidebarIconGrid() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h7v7H4V6zm9 0h7v7h-7V6zM4 15h7v5H4v-5zm9 0h7v5h-7v-5z"
      />
    </svg>
  );
}

function SidebarIconUsers() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20h5v-2a4 4 0 00-4-4h-1m-4 6H2v-2a4 4 0 014-4h3m4-8a4 4 0 11-8 0 4 4 0 018 0zm7 4a3 3 0 10-6 0 3 3 0 006 0z"
      />
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

function SidebarIconShield() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3l8 4v6c0 5-3.438 9.438-8 10-4.562-.562-8-5-8-10V7l8-4z"
      />
    </svg>
  );
}

export default function AdminLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const displayName = getAuthDisplayName(user, "Admin");
  const roleLabel = getAuthRoleLabel(user, "Administrator");

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
            to="/admin"
            end
            className={({ isActive }) => `${navItem} ${isActive ? navActive : ""}`}
          >
            <SidebarIconGrid />
            Dashboard
          </NavLink>
          <NavLink
            to="/admin/faculty"
            className={({ isActive }) => `${navItem} ${isActive ? navActive : ""}`}
          >
            <SidebarIconUsers />
            Faculty
          </NavLink>
          <NavLink
            to="/admin/profile"
            className={({ isActive }) => `${navItem} ${isActive ? navActive : ""}`}
          >
            <SidebarIconUser />
            Profile
          </NavLink>
          <NavLink
            to="/admin/audit"
            className={({ isActive }) => `${navItem} ${isActive ? navActive : ""}`}
          >
            <SidebarIconShield />
            Audit
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
        <LoggedInUserBar roleFallback="Administrator" />
        <Outlet />
      </main>
    </div>
  );
}
