import React, { useContext } from "react";
import { useLocation } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";

const SectionAdminPlaceholderScreen = () => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const title =
    location.pathname.endsWith("/profile") ? "Profile" : location.pathname.endsWith("/audit") ? "Audit" : "Page";

  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          <p className="mt-0.5 text-xs text-gray-500">{user?.roleName || "SectionAdmin"}</p>
          <p className="mt-1 text-xs text-gray-400">This area is not implemented yet.</p>
        </div>
      </div>
    </div>
  );
};

export default SectionAdminPlaceholderScreen;
