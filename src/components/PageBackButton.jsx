import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** Sidebar destinations: no ← (user uses sidebar to move between these). */
const MAIN_TAB_PATHS = new Set([
  "/admin",
  "/admin/faculty",
  "/admin/programs",
  "/admin/enrollment",
  "/admin/grader-allocations",
  "/admin/audit",
  "/teacher",
  "/teacher/attendance",
  "/teacher/graders",
  "/teacher/submit-folders",
  "/grader",
  "/section-admin",
  "/section-admin/enrollment",
  "/section-admin/grader-allocations",
  "/hod",
  "/hod/programs",
  "/hod/graders",
  "/hod/allocation",
  "/hod/plo-results",
  "/hod/submitted-folders",
]);

function isMainTabPath(pathname) {
  if (!pathname) return false;
  const p = pathname.replace(/\/+$/, "") || "/";
  return MAIN_TAB_PATHS.has(p);
}

/**
 * Header back: ← left of the page title on nested routes.
 * Hidden on primary sidebar tabs.
 */
export default function PageBackButton({ className = "" }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (isMainTabPath(pathname)) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      aria-label="Go back"
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold leading-none text-gray-600 transition hover:bg-brand-muted hover:text-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${className}`}
    >
      <span aria-hidden="true">←</span>
    </button>
  );
}
