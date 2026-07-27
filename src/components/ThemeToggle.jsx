import React from "react";
import { useTheme } from "../context/ThemeContext.jsx";

function SunIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364-1.414-1.414M7.05 7.05 5.636 5.636m12.728 0-1.414 1.414M7.05 16.95l-1.414 1.414M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function MoonIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
      />
    </svg>
  );
}

/** Header / login control to switch light and dark theme. */
export default function ThemeToggle({ className = "", variant = "header" }) {
  const { isDark, toggleTheme } = useTheme();

  const base =
    variant === "login"
      ? "flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-[#1a6b45] shadow-sm transition hover:bg-brand-muted"
      : "flex h-10 w-10 items-center justify-center rounded-full text-[#1a6b45] transition hover:bg-brand-muted";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`${base} ${className}`.trim()}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
