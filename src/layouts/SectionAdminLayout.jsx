import React, { useContext } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import LoggedInUserBar from "../components/LoggedInUserBar.jsx";
import AppBrandMark from "../components/AppBrandMark.jsx";
import { getAuthDisplayName, getAuthRoleLabel } from "../utils/helpers";
import { sidebarNavClass } from "../styles/sidebarNav";

function SidebarIconGrid() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h7v7H4V6zm9 0h7v7h-7V6zM4 15h7v5H4v-5zm9 0h7v5h-7v-5z" />
    </svg>
  );
}

function SidebarIconUsers() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-1m-4 6H2v-2a4 4 0 014-4h3m4-8a4 4 0 11-8 0 4 4 0 018 0zm7 4a3 3 0 10-6 0 3 3 0 006 0z" />
    </svg>
  );
}

export default function SectionAdminLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const displayName = getAuthDisplayName(user, "Section Admin");
  const roleLabel = getAuthRoleLabel(user, "Section Admin");

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <AppBrandMark />
          <div>
            <p className="text-sm font-bold text-white">Folder Management</p>
            <p className="text-xs font-medium text-white/70">System</p>
          </div>
        </div>

        <nav className="app-sidebar-nav">
          <NavLink to="/section-admin" end className={sidebarNavClass}>
            <SidebarIconGrid />
            Programs
          </NavLink>
          <NavLink
            to="/section-admin/grader-allocations"
            className={sidebarNavClass}
          >
            <SidebarIconUsers />
            Grader
          </NavLink>
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-sidebar-user">
            <div className="app-sidebar-avatar">
              {displayName.charAt(0).toUpperCase() || "S"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{displayName}</p>
              <p className="truncate text-xs text-white/70">{roleLabel}</p>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="app-logout-btn">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      <main className="min-h-screen w-full min-w-0 flex-1 bg-page">
        <LoggedInUserBar roleFallback="Section Admin" profilePath="/section-admin/profile" />
        <Outlet />
      </main>
    </div>
  );
}
