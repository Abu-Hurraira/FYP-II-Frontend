import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import DashboardWelcomeBanner from "../../components/DashboardWelcomeBanner.jsx";
import { getAuthDisplayName } from "../../utils/helpers";

const SectionAdminDashboardScreen = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const displayName = getAuthDisplayName(user, "Section Admin");

  return (
    <div className="min-h-full bg-page">
      <div className="px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <DashboardWelcomeBanner name={displayName} />

        <div className="mt-4 w-full space-y-2.5">
          <button
            type="button"
            onClick={() => navigate("/section-admin/sessions")}
            className="w-full rounded-2xl border border-gray-100 bg-white shadow-card p-4 text-left shadow-sm transition hover:bg-brand-muted/40"
          >
            <p className="text-sm font-semibold text-gray-900">Sessions and sections</p>
            <p className="mt-1 text-xs text-gray-600">
              View existing sessions and sections. Upload student lists and add students inside sections.
            </p>
          </button>

          <button
            type="button"
            onClick={() => navigate("/section-admin/grader-allocations")}
            className="w-full rounded-2xl border border-gray-100 bg-white shadow-card p-4 text-left shadow-sm transition hover:bg-brand-muted/40"
          >
            <p className="text-sm font-semibold text-gray-900">Assign graders</p>
            <p className="mt-1 text-xs text-gray-600">
              Assign existing grader users to existing teachers or HODs.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SectionAdminDashboardScreen;
