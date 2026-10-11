import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getGraderTasksMine } from "../../api/graderTasksApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert } from "../../utils/dialogs";

const TASK_ITEMS = [
  {
    code: "Attendance",
    title: "Attendance",
    path: (oc, qs) => `/grader/attendance?${qs}&offeredCourseId=${oc}`,
  },
  {
    code: "AssignmentMarks",
    title: "Assignment marks",
    path: (oc, qs) => `/grader/course/${oc}/assignments?${qs}`,
  },
  {
    code: "QuizMarks",
    title: "Quiz marks",
    path: (oc, qs) => `/grader/course/${oc}/quizzes?${qs}`,
  },
  {
    code: "ComponentMarks",
    title: "Component marks",
    path: (oc, qs) => `/grader/course/${oc}/component-marks?${qs}`,
  },
];

export default function GraderCourseMenuScreen() {
  const { offeredCourseId: ocParam } = useParams();
  const offeredCourseId = Number(ocParam);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const teacherUserId = searchParams.get("teacherUserId") || "";
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getGraderTasksMine();
        const match = rows.find((r) => Number(r.offeredCourseId) === offeredCourseId);
        if (!cancelled) setCourse(match || null);
        if (!match) {
          showAlert("No access", "This course is not assigned to you.");
          navigate("/grader", { replace: true });
        }
      } catch (error) {
        if (!cancelled) showAlert("Error", error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [offeredCourseId, navigate, location.key]);

  const assigned = new Set((course?.tasks || []).filter((t) => t.assigned).map((t) => t.taskCode));
  const items = TASK_ITEMS.filter((item) => assigned.has(item.code));
  const customTasks = (course?.tasks || []).filter((t) => t.assigned && !TASK_ITEMS.some((item) => item.code === t.taskCode));
  const teacherQs = `teacherUserId=${teacherUserId || course?.teacherUserId || ""}`;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 dark:border-[#1b2c2e] dark:bg-[#071113]">
        <PageBackButton className="mt-0.5" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {course?.courseTitle || "Course"}
          </h1>
          <p className="mt-0.5 text-xs text-gray-500">
            {course?.courseCode} · {course?.sectionName} · {course?.teacherName}
          </p>
        </div>
      </div>
      <div className="px-4 py-4 sm:px-6">
        {items.length === 0 && customTasks.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">No tasks assigned on this course.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) => {
              const task = course.tasks.find((t) => t.taskCode === item.code);
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => navigate(item.path(offeredCourseId, teacherQs))}
                  className="flex min-h-[72px] items-center rounded-2xl border border-gray-100 bg-white px-5 py-4 text-left shadow-card dark:border-[#1b2c2e] dark:bg-[#0c181a]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-extrabold text-gray-900 dark:text-white">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500">{task?.progressText}</span>
                  </span>
                  <span className="text-2xl font-bold text-gray-300">›</span>
                </button>
              );
            })}
            {customTasks.length > 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-white px-5 py-4 dark:border-[#1b2c2e] dark:bg-[#0c181a]">
                <p className="text-sm font-extrabold text-gray-900 dark:text-white">Other work your teacher allowed</p>
                <ul className="mt-2 space-y-1">
                  {customTasks.map((task) => (
                    <li key={task.taskCode} className="text-sm text-gray-700 dark:text-gray-200">
                      {task.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
