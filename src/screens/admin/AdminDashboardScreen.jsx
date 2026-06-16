import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";

import facultyIcon from "../../../assets/FacultyIcon.png";

const HomeCard = ({ title, iconSource, to }) => (
  <Link
    to={to}
    className="flex min-h-[56px] items-center rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
  >
    <img src={iconSource} alt="" className="mr-3 h-9 w-9 shrink-0 object-contain" />
    <span className="text-base font-semibold text-gray-900">{title}</span>
  </Link>
);

const AdminDashboardScreen = () => {
  const { user } = useContext(AuthContext);

  return (
    <div className="min-h-full w-full px-4 pb-8 pt-4 sm:px-6 lg:px-8">
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">Home</h1>
        <p className="text-xs text-gray-500">{user?.roleName || "Administrator"}</p>
      </div>

      <div className="grid w-full gap-3 sm:grid-cols-2">
        <HomeCard title="Faculty" iconSource={facultyIcon} to="/admin/faculty" />
      </div>
    </div>
  );
};

export default AdminDashboardScreen;
