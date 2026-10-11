import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import DashboardWelcomeBanner from "../../components/DashboardWelcomeBanner.jsx";
import { getAuthDisplayName } from "../../utils/helpers";

import facultyIcon from "../../../assets/FacultyIcon.png";

const HomeCard = ({ title, icon, badgeBg, to }) => (
  <Link
    to={to}
    className="flex min-h-[64px] items-center rounded-2xl border border-gray-200/80 bg-white px-5 py-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
  >
    <div className={`mr-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${badgeBg}`}>
      {icon}
    </div>
    <span className="text-base font-bold tracking-tight text-gray-900">{title}</span>
  </Link>
);

const AdminDashboardScreen = () => {
  const { user } = useContext(AuthContext);
  const displayName = getAuthDisplayName(user, "Administrator");

  return (
    <div className="min-h-full w-full px-4 pb-8 pt-4 sm:px-6 lg:px-8">
      <DashboardWelcomeBanner name={displayName} />

      <div className="mt-6 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HomeCard
          title="Faculty"
          badgeBg="bg-indigo-600 shadow-indigo-200"
          to="/admin/faculty"
          icon={(
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-1m-4 6H2v-2a4 4 0 014-4h3m4-8a4 4 0 11-8 0 4 4 0 018 0zm7 4a3 3 0 10-6 0 3 3 0 006 0z" />
            </svg>
          )}
        />

        <HomeCard
          title="Programs & Sessions"
          badgeBg="bg-teal-600 shadow-teal-200"
          to="/admin/programs"
          icon={(
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          )}
        />

        <HomeCard
          title="Student Course Enrollment"
          badgeBg="bg-amber-600 shadow-amber-200"
          to="/admin/enrollment"
          icon={(
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        />

        <HomeCard
          title="Grader Allocations"
          badgeBg="bg-rose-600 shadow-rose-200"
          to="/admin/grader-allocations"
          icon={(
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          )}
        />
      </div>
    </div>
  );
};

export default AdminDashboardScreen;
