import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getGraderAllocations } from "../../api/graderAllocationsApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import LoggedInUserBar from "../../components/LoggedInUserBar.jsx";
import { getAuthDisplayName, getAuthUserId } from "../../utils/helpers";
import { showAlert } from "../../utils/dialogs";

export default function GraderHomeScreen() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const graderId = getAuthUserId(user);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getGraderAllocations();
        const list = (Array.isArray(data) ? data : [])
          .map((g) => ({
            id: g.graderAllocationId ?? g.GraderAllocationId,
            teacherUserId: g.teacherUserId ?? g.TeacherUserId,
            teacherName: g.teacherName ?? g.TeacherName ?? "",
            teacherEmail: g.teacherEmail ?? g.TeacherEmail ?? "",
            graderUserId: g.graderUserId ?? g.GraderUserId,
          }))
          .filter((g) => Number(g.graderUserId) === Number(graderId));
        if (!cancelled) setRows(list);
      } catch (error) {
        if (!cancelled) showAlert("Error", error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [graderId]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-page">
      <LoggedInUserBar roleFallback="Grader" profilePath="/grader/profile" />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Hello, {getAuthDisplayName(user, "Grader")}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              You are assigned to assist these teachers. Folder and mark entry stay under the teacher’s course workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a] dark:text-gray-200"
          >
            Logout
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center shadow-card dark:border-[#1b2c2e] dark:bg-[#0c181a]">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              No teacher allocations yet.
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Ask an administrator or HOD to assign you under Grader Allocations.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-card dark:border-[#1b2c2e] dark:bg-[#0c181a]"
              >
                <p className="text-sm font-bold text-gray-900 dark:text-white">{row.teacherName}</p>
                <p className="mt-0.5 text-xs text-gray-500">{row.teacherEmail}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
