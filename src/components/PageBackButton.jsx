import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** Top-level sidebar destinations: no ← (user uses sidebar to move between these). */
const MAIN_TAB_PATHS = new Set([
  "/admin",
  "/admin/faculty",
  "/admin/profile",
  "/admin/audit",
  "/teacher",
  "/teacher/profile",
  "/teacher/submit-folders",
  "/teacher/placeholder",
  "/section-admin",
  "/section-admin/profile",
  "/section-admin/audit",
  "/section-admin/grader-allocations",
  "/hod",
  "/hod/courses",
  "/hod/programs",
  "/hod/graders",
  "/hod/profile",
]);

function isMainTabPath(pathname) {
  if (!pathname) return false;
  const p = pathname.replace(/\/+$/, "") || "/";
  return MAIN_TAB_PATHS.has(p);
}

/**
 * Header back: ← only, left of the page title on nested routes.
 * Hidden on primary sidebar “tab” pages (Programs list, Courses, etc.).
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
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl font-semibold leading-none text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${className}`}
    >
      <span aria-hidden="true">←</span>
    </button>
  );
}
