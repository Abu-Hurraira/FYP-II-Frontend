import React, { useContext } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import LoggedInUserBar from "../components/LoggedInUserBar.jsx";
import AppBrandMark from "../components/AppBrandMark.jsx";
import { getAuthDisplayName, getAuthRoleLabel } from "../utils/helpers";
import { sidebarNavClass } from "../styles/sidebarNav";

export default function GraderLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const displayName = getAuthDisplayName(user, "Grader");
  const roleLabel = getAuthRoleLabel(user, "Grader");

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
          <NavLink to="/grader" end className={sidebarNavClass}>
            Assigned work
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
        <LoggedInUserBar roleFallback="Grader" profilePath="/grader/profile" />
        <Outlet />
      </main>
    </div>
  );
}
