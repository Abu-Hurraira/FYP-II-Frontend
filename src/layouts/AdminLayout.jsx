import React, { useContext } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import LoggedInUserBar from "../components/LoggedInUserBar.jsx";
import AppBrandMark from "../components/AppBrandMark.jsx";
import { getAuthDisplayName, getAuthRoleLabel } from "../utils/helpers";
import { sidebarNavClass } from "../styles/sidebarNav";
import { useSidebarDrawer } from "../hooks/useSidebarDrawer";

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

function SidebarIconShield() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l8 4v6c0 5-3.438 9.438-8 10-4.562-.562-8-5-8-10V7l8-4z" />
    </svg>
  );
}

function SidebarIconFolder() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

function SidebarIconAcademic() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  );
}

function SidebarIconUserCheck() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default function AdminLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { sidebarOpen, openSidebar, closeSidebar } = useSidebarDrawer();

  const displayName = getAuthDisplayName(user, "Admin");
  const roleLabel = getAuthRoleLabel(user, "Administrator");

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
          <NavLink to="/admin" end className={sidebarNavClass}>
            <SidebarIconGrid />
            Dashboard
          </NavLink>
          <NavLink to="/admin/faculty" className={sidebarNavClass}>
            <SidebarIconUsers />
            Faculty
          </NavLink>
          <NavLink to="/admin/programs" className={sidebarNavClass}>
            <SidebarIconFolder />
            Programs & Sessions
          </NavLink>
          <NavLink to="/admin/enrollment" className={sidebarNavClass}>
            <SidebarIconUserCheck />
            Enrollment
          </NavLink>
          <NavLink to="/admin/grader-allocations" className={sidebarNavClass}>
            <SidebarIconShield />
            Graders
          </NavLink>
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-sidebar-user">
            <div className="app-sidebar-avatar">
              {displayName.charAt(0).toUpperCase() || "A"}
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
          roleFallback="Administrator"
          profilePath="/admin/profile"
          onMenuClick={openSidebar}
        />
        <Outlet />
      </main>
    </div>
  );
}
