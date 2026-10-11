import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getGraderTasksMine } from "../../api/graderTasksApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import { getAuthDisplayName } from "../../utils/helpers";
import { showAlert } from "../../utils/dialogs";

export default function GraderHomeScreen() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getGraderTasksMine();
        if (!cancelled) setRows(data);
      } catch (error) {
        if (!cancelled) showAlert("Error", error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-full bg-page">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Hello, {getAuthDisplayName(user, "Grader")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Only the courses and tasks your teacher assigned are available.
        </p>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center shadow-card dark:border-[#1b2c2e] dark:bg-[#0c181a]">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">No assigned tasks yet.</p>
            <p className="mt-1 text-sm text-gray-500">
              Wait for your teacher to save a task list, or ask Admin/HOD to allocate you.
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {rows.map((row) => {
              const assigned = (row.tasks || []).filter((t) => t.assigned);
              return (
                <li key={`${row.graderAllocationId}-${row.offeredCourseId}`}>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/grader/course/${row.offeredCourseId}/menu?teacherUserId=${row.teacherUserId || ""}`
                      )
                    }
                    className="w-full rounded-2xl border border-gray-100 bg-white px-4 py-4 text-left shadow-card dark:border-[#1b2c2e] dark:bg-[#0c181a]"
                  >
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{row.courseTitle}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {row.courseCode} · {row.sectionName} · {row.teacherName}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {assigned.map((task) => (
                        <span
                          key={task.taskCode}
                          className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        >
                          {task.label}: {task.progressText}
                        </span>
                      ))}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
