import React, { useContext } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";

export default function HodAllocationScreen() {
  const { user } = useContext(AuthContext);

  return (
    <div className="min-h-full bg-page">
      <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold text-gray-900">Allocation</h1>
        <p className="mt-0.5 text-sm text-gray-500">{user?.fullName || user?.name || "HOD"}</p>
      </div>

      <div className="w-full px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-sm font-semibold text-gray-800">Coming soon</p>
          <p className="mt-2 text-sm text-gray-500">
            Teacher and grader allocation for HOD will be available in a future update.
          </p>
        </div>
      </div>
    </div>
  );
}
