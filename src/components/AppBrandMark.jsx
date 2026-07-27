import React from "react";
import logoUrl from "../../assets/BIITLogo.png";

/** BIIT logo used in sidebars instead of the old "F" mark. */
export default function AppBrandMark({ className = "h-10 w-10" }) {
  return (
    <img
      src={logoUrl}
      alt="BIIT"
      className={`shrink-0 rounded-full border-2 border-white/30 bg-white bg-keep-white object-cover shadow-sm ${className}`}
    />
  );
}
