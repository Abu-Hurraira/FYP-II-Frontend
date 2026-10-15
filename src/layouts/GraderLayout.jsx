import React, { useContext } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import LoggedInUserBar from "../components/LoggedInUserBar.jsx";
import AppBrandMark from "../components/AppBrandMark.jsx";
import { getAuthDisplayName, getAuthRoleLabel } from "../utils/helpers";
import { sidebarNavClass } from "../styles/sidebarNav";
import { useSidebarDrawer } from "../hooks/useSidebarDrawer";

export default function GraderLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { sidebarOpen, openSidebar, closeSidebar } = useSidebarDrawer();
  const displayName = getAuthDisplayName(user, "Grader");
  const roleLabel = getAuthRoleLabel(user, "Grader");

  const handleLogout = async () => {
    closeSidebar();
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-page">
      {sidebarOpen && (
        <div
          className="app-sidebar-backdrop"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <aside className={`app-sidebar${sidebarOpen ? " app-sidebar--open" : ""}`}>
        <div className="app-sidebar-brand justify-between">
          <div className="flex items-center gap-3">
            <AppBrandMark />
            <div>
              <p className="text-sm font-bold text-white">Folder Management</p>
              <p className="text-xs font-medium text-white/70">System</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeSidebar}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="app-sidebar-nav" onClick={closeSidebar}>
          <NavLink to="/grader" end className={sidebarNavClass}>
            Dashboard
          </NavLink>
        </nav>
        <div className="app-sidebar-footer">
          <div className="app-sidebar-user">
            <div className="app-sidebar-avatar">{displayName.charAt(0).toUpperCase() || "G"}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{displayName}</p>
              <p className="truncate text-xs text-white/70">{roleLabel}</p>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="app-logout-btn">
            Logout
          </button>
        </div>
      </aside>
      <main className="min-h-screen w-full min-w-0 flex-1 bg-page">
        <LoggedInUserBar
          roleFallback="Grader"
          profilePath="/grader/profile"
          onMenuClick={openSidebar}
        />
        <Outlet />
      </main>
    </div>
  );
}
