import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";

const SectionAdminDashboardScreen = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <div className="min-h-full bg-page">
      <div className="px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-lg border border-gray-200 bg-brand px-4 py-5 text-white shadow-sm sm:px-6">
          <h1 className="text-xl font-semibold">Section admin</h1>
          <p className="mt-0.5 text-xs opacity-90">{user?.roleName || "SectionAdmin"}</p>
        </div>

      <div className="w-full space-y-2.5">
        <button
          type="button"
          onClick={() => navigate("/section-admin/sessions")}
          className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:bg-gray-50"
        >
          <p className="text-sm font-semibold text-gray-900">Sessions and sections</p>
          <p className="mt-1 text-xs text-gray-600">
            View existing sessions and sections. Upload student lists and add students inside sections.
          </p>
        </button>

        <button
          type="button"
          onClick={() => navigate("/section-admin/grader-allocations")}
          className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:bg-gray-50"
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
