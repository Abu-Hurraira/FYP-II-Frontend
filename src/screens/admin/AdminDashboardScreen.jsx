import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import DashboardWelcomeBanner from "../../components/DashboardWelcomeBanner.jsx";
import { getAuthDisplayName } from "../../utils/helpers";

import facultyIcon from "../../../assets/FacultyIcon.png";

const HomeCard = ({ title, iconSource, to }) => (
  <Link
    to={to}
    className="flex min-h-[56px] items-center rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition hover:border-gray-300 hover:bg-brand-muted/40"
  >
    <img src={iconSource} alt="" className="mr-3 h-9 w-9 shrink-0 object-contain" />
    <span className="text-base font-semibold text-gray-900">{title}</span>
  </Link>
);

const AdminDashboardScreen = () => {
  const { user } = useContext(AuthContext);
  const displayName = getAuthDisplayName(user, "Administrator");

  return (
    <div className="min-h-full w-full px-4 pb-8 pt-4 sm:px-6 lg:px-8">
      <DashboardWelcomeBanner name={displayName} />

      <div className="mt-4 grid w-full gap-3 sm:grid-cols-2">
        <HomeCard title="Faculty" iconSource={facultyIcon} to="/admin/faculty" />
      </div>
    </div>
  );
};

export default AdminDashboardScreen;
