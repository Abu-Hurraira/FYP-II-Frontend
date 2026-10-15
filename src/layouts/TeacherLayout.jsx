import React, { useContext } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import LoggedInUserBar from "../components/LoggedInUserBar.jsx";
import AppBrandMark from "../components/AppBrandMark.jsx";
import { getAuthDisplayName, getAuthRoleLabel } from "../utils/helpers";
import { sidebarNavClass } from "../styles/sidebarNav";
import { useSidebarDrawer } from "../hooks/useSidebarDrawer";

function SidebarIconDashboard() {
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

export default function TeacherLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { sidebarOpen, openSidebar, closeSidebar } = useSidebarDrawer();

  const displayName = getAuthDisplayName(user, "Teacher");
  const roleLabel = getAuthRoleLabel(user, "Teacher");

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
          <NavLink to="/teacher" end className={sidebarNavClass}>
            <SidebarIconDashboard />
            Dashboard
          </NavLink>
          <NavLink to="/teacher/attendance" className={sidebarNavClass}>
            <SidebarIconAttendance />
            Attendance
          </NavLink>
          <NavLink to="/teacher/graders" className={sidebarNavClass}>
            <span className="text-lg leading-none">✓</span>
            My Graders
          </NavLink>

          <div className="my-3 border-t border-white/10" />

          <NavLink to="/teacher/submit-folders" className={sidebarNavClass}>
            <span className="text-lg leading-none">➤</span>
            Submit folders
          </NavLink>
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-sidebar-user">
            <div className="app-sidebar-avatar">
              {displayName.charAt(0).toUpperCase() || "T"}
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
        <LoggedInUserBar
          roleFallback="Teacher"
          profilePath="/teacher/profile"
          notificationsPath="/teacher/notifications"
          onMenuClick={openSidebar}
        />
        <Outlet />
      </main>
    </div>
  );
}
