import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getGraderTasksMine } from "../../api/graderTasksApi";
import request from "../../api/apiClient";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert } from "../../utils/dialogs";
import { checkTeacherTaskCompleteness, showIncompleteTaskAlert } from "../../utils/graderTaskStatus";

// Task visual icons
function TaskIcon({ code, isIncomplete }) {
  const baseClass = `h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
    isIncomplete
      ? "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300"
      : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300"
  }`;

  if (code === "Attendance") {
    return (
      <div className={baseClass}>
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }
  if (code.includes("Assignment")) {
    return (
      <div className={baseClass}>
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
    );
  }
  if (code.includes("Quiz")) {
    return (
      <div className={baseClass}>
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    );
  }
  if (code.includes("Exam")) {
    return (
      <div className={baseClass}>
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      </div>
    );
  }
  return (
    <div className={baseClass}>
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    </div>
  );
}

const TASK_ITEMS = [
  {
    code: "Attendance",
    title: "Attendance",
    hint: "Mark student attendance",
    path: (oc, qs) => `/grader/attendance?${qs}&offeredCourseId=${oc}`,
  },
  {
    code: "AssignmentMarks",
    title: "Assignment marks",
    hint: "Enter assignment scores",
    path: (oc, qs) => `/grader/course/${oc}/assignments?${qs}&focus=marks`,
  },
  {
    code: "QuizMarks",
    title: "Quiz marks",
    hint: "Enter quiz scores",
    path: (oc, qs) => `/grader/course/${oc}/quizzes?${qs}&focus=marks`,
  },
  {
    code: "ExamMarks",
    title: "Exam marks",
    hint: "Mid & Final mark sheets",
    path: (oc, qs) => `/grader/course/${oc}/exam-marks?${qs}`,
  },
  {
    code: "ComponentMarks",
    title: "Component marks",
    hint: "Homework / lab style components",
    path: (oc, qs) => `/grader/course/${oc}/component-marks?${qs}`,
  },
  {
    code: "Assignment",
    title: "Assignment samples",
    hint: "Upload Best / Average / Worst samples",
    path: (oc, qs) => `/grader/course/${oc}/assignments?${qs}&focus=samples`,
  },
  {
    code: "Quiz",
    title: "Quiz samples",
    hint: "Upload Best / Average / Worst samples",
    path: (oc, qs) => `/grader/course/${oc}/quizzes?${qs}&focus=samples`,
  },
  {
    code: "ExamSamples",
    title: "Exam samples",
    hint: "Upload Mid / Final sample PDFs",
    path: (oc, qs) => `/grader/course/${oc}/exam-samples?${qs}`,
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
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const rows = await getGraderTasksMine();
        const match = rows.find((r) => Number(r.offeredCourseId) === offeredCourseId);
        if (!cancelled) setCourse(match || null);
        if (!match) {
          showAlert("No access", "This course is not assigned to you.");
          navigate("/grader", { replace: true });
          return;
        }

        const effectiveTeacherId = teacherUserId || match.teacherUserId || "";
        try {
          const list = await request(
            `/Assessments/offered-course/${offeredCourseId}?teacherUserId=${effectiveTeacherId}`
          );
          if (!cancelled) setAssessments(Array.isArray(list) ? list : []);
        } catch {
          if (!cancelled) setAssessments([]);
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
  }, [offeredCourseId, navigate, location.key, teacherUserId]);

  const assigned = new Set((course?.tasks || []).filter((t) => t.assigned).map((t) => t.taskCode));
  const items = TASK_ITEMS.filter((item) => assigned.has(item.code));
  const customTasks = (course?.tasks || []).filter(
    (t) => t.assigned && !TASK_ITEMS.some((item) => item.code === t.taskCode)
  );
  const teacherQs = `teacherUserId=${teacherUserId || course?.teacherUserId || ""}`;

  const handleCardClick = (item, task) => {
    const check = checkTeacherTaskCompleteness(task, assessments);
    if (check.isIncomplete) {
      showIncompleteTaskAlert(item.title, check.reason);
      return;
    }
    navigate(item.path(offeredCourseId, teacherQs));
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-full w-full bg-page">
      {/* Course Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-4 sm:px-6 lg:px-8 dark:border-[#1b2c2e] dark:bg-[#071113]">
        <div className="flex items-center gap-3 min-w-0">
          <PageBackButton />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">
              {course?.courseTitle || "Course"}
            </h1>
            <p className="mt-0.5 truncate text-xs text-gray-500 sm:text-sm dark:text-gray-400">
              {course?.courseCode} · {course?.sectionName} · Teacher: <span className="font-medium text-gray-700 dark:text-gray-300">{course?.teacherName}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Full-Width Content Container */}
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-200/70 pb-4 dark:border-[#1b2c2e]">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-gray-900 sm:text-xl dark:text-white">
              Assigned Tasks & Marking Modules
            </h2>
            <p className="mt-1 text-xs text-gray-500 sm:text-sm dark:text-gray-400">
              Only tasks your teacher assigned are active below. Red rows indicate incomplete teacher setup.
            </p>
          </div>
        </div>

        {items.length === 0 && customTasks.length === 0 ? (
          <div className="w-full rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center dark:border-[#1b2c2e] dark:bg-[#0c181a]">
            <p className="text-base font-semibold text-gray-800 dark:text-gray-200">No tasks assigned</p>
            <p className="mt-1 text-sm text-gray-500">Your teacher has not allocated any tasks for this course yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 w-full">
            {items.map((item) => {
              const task = (course?.tasks || []).find((t) => t.taskCode === item.code);
              const check = checkTeacherTaskCompleteness(task, assessments);
              const isIncomplete = check.isIncomplete;

              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => handleCardClick(item, task)}
                  className={`group relative flex w-full flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border px-5 py-4 text-left transition duration-150 hover:shadow-sm active:scale-[0.99] ${
                    isIncomplete
                      ? "border-rose-300/80 bg-rose-50/70 text-rose-950 hover:border-rose-400 hover:bg-rose-100/70 dark:border-rose-900/60 dark:bg-rose-950/25 dark:text-rose-100 dark:hover:border-rose-800"
                      : "border-slate-200/80 bg-white hover:border-emerald-300 hover:bg-emerald-50/20 dark:border-[#1b2c2e] dark:bg-[#0c181a] dark:hover:border-emerald-800/60"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <TaskIcon code={item.code} isIncomplete={isIncomplete} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-base font-bold sm:text-lg ${
                          isIncomplete ? "text-rose-900 dark:text-rose-200" : "text-gray-900 dark:text-white"
                        }`}>
                          {item.title}
                        </span>
                        {isIncomplete ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-100/90 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/80 dark:text-rose-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                            Teacher Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-[#e8f8f0] px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/50 dark:text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Ready to Mark
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500 sm:text-sm dark:text-gray-400">
                        {item.hint}
                        {task?.progressText ? ` · ${task.progressText}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Right chevron or warning indicator */}
                  <div className="shrink-0 flex items-center justify-end">
                    {isIncomplete ? (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600 dark:bg-rose-950/80 dark:text-rose-300">
                        !
                      </span>
                    ) : (
                      <span className="text-2xl font-bold text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600 dark:text-gray-600">
                        ›
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Custom teacher notes/tasks */}
        {customTasks.length > 0 && (
          <div className="mt-6 w-full rounded-2xl border border-gray-100 bg-white p-5 shadow-xs dark:border-[#1b2c2e] dark:bg-[#0c181a]">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Other work your teacher allowed
            </p>
            <ul className="mt-2 space-y-1">
              {customTasks.map((task) => (
                <li key={task.taskCode} className="text-sm text-gray-700 dark:text-gray-300">
                  • {task.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
