import React from "react";
import { useTheme } from "../context/ThemeContext.jsx";
import welcomeArtLightUrl from "../../assets/dashboard-welcome-art.png";
import welcomeArtDarkUrl from "../../assets/dashboard-welcome-art-dark.png";

const TITLE_TOKENS = new Set(["dr", "dr.", "mr", "mr.", "mrs", "mrs.", "ms", "ms.", "miss", "prof", "prof."]);

function welcomeFirstName(name) {
  const parts = String(name || "there")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "there";
  const first = parts[0];
  if (TITLE_TOKENS.has(first.toLowerCase()) && parts.length > 1) {
    return parts[1];
  }
  return first;
}

/** Shared welcome strip for every role dashboard. */
export default function DashboardWelcomeBanner({ name = "there", subtitle }) {
  const { isDark } = useTheme();
  const firstName = welcomeFirstName(name);
  const line = subtitle || "Here's what's happening with your folders today.";

  return (
    <section className="dashboard-welcome-banner" aria-label="Welcome">
      <div className="dashboard-welcome-banner__content">
        <div className="min-w-0 flex-1">
          <h1 className="dashboard-welcome-banner__title text-lg font-bold tracking-tight text-gray-900 sm:text-xl">
            Welcome back, {firstName}! <span aria-hidden="true">👋</span>
          </h1>
          <p className="dashboard-welcome-banner__subtitle mt-1 text-sm text-gray-500">{line}</p>
        </div>
        <img
          src={isDark ? welcomeArtDarkUrl : welcomeArtLightUrl}
          alt=""
          className={`dashboard-welcome-banner__art pointer-events-none hidden select-none sm:block ${
            isDark ? "dashboard-welcome-banner__art--dark" : ""
          }`}
        />
      </div>
    </section>
  );
}
