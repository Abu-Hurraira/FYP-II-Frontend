import React, { useContext, useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import { HodProgramProvider, useHodProgram } from "../context/HodProgramContext.jsx";
import LoggedInUserBar from "../components/LoggedInUserBar.jsx";
import AppBrandMark from "../components/AppBrandMark.jsx";
import AppSelect from "../components/AppSelect.jsx";
import { getAuthDisplayName, getAuthRoleLabel } from "../utils/helpers";
import { sidebarNavClassFromActive } from "../styles/sidebarNav";
import { useSidebarDrawer } from "../hooks/useSidebarDrawer";

function normalizePath(path) {
  return String(path || "/").replace(/\/+$/, "") || "/";
}

function isExactPath(pathname, target) {
  return normalizePath(pathname) === normalizePath(target);
}

function isPathOrChild(pathname, target) {
  const current = normalizePath(pathname);
  const base = normalizePath(target);
  return current === base || current.startsWith(`${base}/`);
}

function SidebarIconGrid() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h7v7H4V6zm9 0h7v7h-7V6zM4 15h7v5H4v-5zm9 0h7v5h-7v-5z" />
    </svg>
  );
}

function SidebarIconAcademic() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0112 21.5c-2.305 0-4.463-.65-6.16-1.922L12 14z" />
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

function SidebarIconFolder() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}

function SidebarIconChart() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function SidebarIconClipboard() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function programOptionLabel(program) {
  const code = String(program.programCode || "").trim();
  const name = String(program.programName || "").trim();
  if (code && name) return `${code} — ${name}`;
  return name || code || `Program ${program.programId}`;
}

function HodProgramSwitcher() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { programs, selectedProgramId, selectedProgram, loading, setSelectedProgramId } = useHodProgram();

  // Keep context in sync when browsing nested /hod/program/:programId routes
  useEffect(() => {
    const match = pathname.match(/^\/hod\/program\/(\d+)/);
    if (!match) return;
    const id = Number(match[1]);
    if (Number.isFinite(id) && id > 0 && id !== selectedProgramId) {
      setSelectedProgramId(id);
    }
  }, [pathname, selectedProgramId, setSelectedProgramId]);

  const handleChange = (e) => {
    const nextId = Number(e.target.value);
    if (!Number.isFinite(nextId) || nextId <= 0) return;
    const nextProgram = programs.find((p) => p.programId === nextId);
    setSelectedProgramId(nextId);

    if (pathname.startsWith("/hod/program/")) {
      navigate(`/hod/program/${nextId}/menu`, {
        replace: true,
        state: { program: nextProgram },
      });
    }
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="hidden min-w-0 sm:block">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Active program</p>
        <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
          {loading
            ? "Loading…"
            : selectedProgram
              ? programOptionLabel(selectedProgram)
              : "No programs yet"}
        </p>
      </div>
      <AppSelect
        value={selectedProgramId ?? ""}
        onChange={handleChange}
        disabled={loading || programs.length === 0}
        className="w-full max-w-[8.5rem] sm:max-w-[14rem] rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm font-semibold text-gray-800 outline-none dark:border-[#1b2c2e] dark:bg-[#0d181a] dark:text-gray-100"
        emptyLabel="No programs"
      >
        {programs.map((p) => (
          <option key={p.programId} value={p.programId}>
            {programOptionLabel(p)}
          </option>
        ))}
      </AppSelect>
    </div>
  );
}

function HodLayoutInner() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { sidebarOpen, openSidebar, closeSidebar } = useSidebarDrawer();

  const displayName = getAuthDisplayName(user, "HOD");
  const roleLabel = getAuthRoleLabel(user, "HOD");

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
          <NavLink to="/hod" end className={sidebarNavClassFromActive(isExactPath(pathname, "/hod"))}>
            <SidebarIconGrid />
            Home
          </NavLink>
          <NavLink to="/hod/programs" className={sidebarNavClassFromActive(isPathOrChild(pathname, "/hod/programs"))}>
            <SidebarIconAcademic />
            Programs
          </NavLink>
          <NavLink to="/hod/graders" className={sidebarNavClassFromActive(isExactPath(pathname, "/hod/graders"))}>
            <SidebarIconUsers />
            Graders
          </NavLink>
          <NavLink to="/hod/allocation" end className={sidebarNavClassFromActive(isExactPath(pathname, "/hod/allocation"))}>
            <SidebarIconClipboard />
            Allocation
          </NavLink>
          <NavLink to="/hod/plo-results" className={sidebarNavClassFromActive(isExactPath(pathname, "/hod/plo-results"))}>
            <SidebarIconChart />
            PLO Results
          </NavLink>
          <NavLink
            to="/hod/submitted-folders"
            className={sidebarNavClassFromActive(isPathOrChild(pathname, "/hod/submitted-folders"))}
          >
            <SidebarIconFolder />
            Submitted Folders
          </NavLink>
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-sidebar-user">
            <div className="app-sidebar-avatar">
              {displayName.charAt(0).toUpperCase() || "H"}
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
          roleFallback="HOD"
          profilePath="/hod/profile"
          notificationsPath="/hod/notifications"
          leading={<HodProgramSwitcher />}
          onMenuClick={openSidebar}
        />
        <Outlet />
      </main>
    </div>
  );
}

export default function HodLayout() {
  return (
    <HodProgramProvider>
      <HodLayoutInner />
    </HodProgramProvider>
  );
}
