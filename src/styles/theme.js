import React from "react";

const light = {
  primary: "#22c55e",
  primaryDark: "#1a6b45",
  accent: "#4ade80",
  background: "#f9fafb",
  white: "#FFFFFF",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  shadow: "#000000",
  greenIcon: "#22c55e",
  orangeIcon: "#FF6D00",
  purpleIcon: "#A23BFF",
  pinkIcon: "#F72C91",
  inProgressBg: "#dcfce7",
  inProgressText: "#166534",
  submittedBg: "#DBEAFE",
  submittedText: "#1D4ED8",
  danger: "#DC2626",
};

const dark = {
  ...light,
  primary: "#2bd576",
  primaryDark: "#168c50",
  accent: "#54ed98",
  background: "#071011",
  white: "#0d181a",
  text: "#f1f7f4",
  muted: "#8fa5a0",
  border: "#1b2c2e",
  inProgressBg: "#0d2b20",
  inProgressText: "#54ed98",
  submittedBg: "#1e3a5f",
  submittedText: "#93c5fd",
};

function isDarkMode() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

/** Prefer CSS variables; theme.js adapts when read during render after a theme toggle remounts. */
const theme = {
  get colors() {
    return isDarkMode() ? dark : light;
  },
};

export default theme;
