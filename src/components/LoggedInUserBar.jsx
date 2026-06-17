import React, { useContext } from "react";
import { AuthContext } from "../context/AuthContext.jsx";
import { getAuthDisplayName, getAuthRoleLabel } from "../utils/helpers";

export default function LoggedInUserBar({ roleFallback = "User" }) {
  const { user } = useContext(AuthContext);
  const displayName = getAuthDisplayName(user, roleFallback);
  const roleLabel = getAuthRoleLabel(user, roleFallback);

  return (
    <div className="sticky top-0 z-20 flex items-center justify-end gap-2 border-b border-gray-200 bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6 lg:px-8">
      <div className="text-right">
        <p className="text-sm font-semibold text-gray-900">{displayName}</p>
        <p className="text-xs text-gray-500">{roleLabel}</p>
      </div>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
        {displayName.charAt(0).toUpperCase() || "U"}
      </div>
    </div>
  );
}
