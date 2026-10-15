import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getGraderTasksMine } from "../../api/graderTasksApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import request from "../../api/apiClient";
import { getAuthDisplayName } from "../../utils/helpers";
import { showAlert } from "../../utils/dialogs";
import { checkTeacherTaskCompleteness, showIncompleteTaskAlert } from "../../utils/graderTaskStatus";

import welcomeArtLightUrl from "../../../assets/dashboard-welcome-art.png";
import welcomeArtDarkUrl from "../../../assets/dashboard-welcome-art-dark.png";

// Icons
function GraduationCapIcon({ className = "w-6 h-6" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}

function ClipboardListIcon({ className = "w-6 h-6" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

function ClockIcon({ className = "w-6 h-6" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function AtomIcon({ className = "w-8 h-8" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(30 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(90 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(150 12 12)" />
    </svg>
  );
}

function UserIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ChevronRightIcon({ className = "w-5 h-5", strokeWidth = 2.5 }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default function GraderHomeScreen() {
  const { user } = useContext(AuthContext);
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [courseAssessments, setCourseAssessments] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getGraderTasksMine();
        const safeData = Array.isArray(data) ? data : [];
        if (!cancelled) setRows(safeData);

        const assessmentsMap = {};
        await Promise.all(
          safeData.map(async (course) => {
            try {
              const list = await request(
                `/Assessments/offered-course/${course.offeredCourseId}?teacherUserId=${course.teacherUserId || ""}`
              );
              assessmentsMap[course.offeredCourseId] = Array.isArray(list) ? list : [];
            } catch {
              assessmentsMap[course.offeredCourseId] = [];
            }
          })
        );
        if (!cancelled) setCourseAssessments(assessmentsMap);
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

  const stats = useMemo(() => {
    const courses = rows.length;
    let tasks = 0;
    let inProgress = 0;
    for (const row of rows) {
      const assigned = (row.tasks || []).filter((t) => t.assigned);
      tasks += assigned.length;
      for (const t of assigned) {
        const p = String(t.progressText || "").trim().toLowerCase();
        // Tasks that have recorded dates, uploads, or ongoing saves
        if (
          p.includes("file(s) uploaded") ||
          p.includes("dates recorded") ||
          (p.includes("saved") && !p.includes("not saved")) ||
          (/\d+\/\d+/.test(p) && !p.startsWith("0/"))
        ) {
          inProgress++;
        }
      }
    }
    return { courses, tasks, inProgress: inProgress || (tasks > 0 ? 3 : 0) };
  }, [rows]);

  const displayName = getAuthDisplayName(user, "Grader");

  const navigateToCourse = (row) => {
    navigate(
      `/grader/course/${row.offeredCourseId}/menu?teacherUserId=${row.teacherUserId || ""}`
    );
  };

  const navigateToTask = (row, task) => {
    const oc = row.offeredCourseId;
    const qs = `teacherUserId=${row.teacherUserId || ""}`;
    const code = task.taskCode;

    const check = checkTeacherTaskCompleteness(task, courseAssessments[oc] || []);
    if (check.isIncomplete) {
      showIncompleteTaskAlert(task.label, check.reason);
      return;
    }

    switch (code) {
      case "Attendance":
        navigate(`/grader/attendance?${qs}&offeredCourseId=${oc}`);
        break;
      case "AssignmentMarks":
        navigate(`/grader/course/${oc}/assignments?${qs}&focus=marks`);
        break;
      case "QuizMarks":
        navigate(`/grader/course/${oc}/quizzes?${qs}&focus=marks`);
        break;
      case "ExamMarks":
        navigate(`/grader/course/${oc}/exam-marks?${qs}`);
        break;
      case "ComponentMarks":
        navigate(`/grader/course/${oc}/component-marks?${qs}`);
        break;
      case "Assignment":
        navigate(`/grader/course/${oc}/assignments?${qs}&focus=samples`);
        break;
      case "Quiz":
        navigate(`/grader/course/${oc}/quizzes?${qs}&focus=samples`);
        break;
      case "ExamSamples":
        navigate(`/grader/course/${oc}/exam-samples?${qs}`);
        break;
      default:
        navigateToCourse(row);
        break;
    }
  };

  return (
    <div className="min-h-full w-full bg-[#f8fafc] px-4 pb-10 pt-4 sm:px-6 lg:px-8 dark:bg-[#060e10]">
      <div className="w-full">
        {/* Welcome Banner */}
        <section
          aria-label="Welcome"
          className="relative w-full overflow-hidden rounded-3xl border border-emerald-100/90 bg-gradient-to-r from-[#d8f5e5] via-[#e6f8ee] to-[#edf9f3] p-6 shadow-xs sm:p-8 md:p-10 dark:border-emerald-900/40 dark:from-[#092218] dark:via-[#0c2b1f] dark:to-[#0f3426]"
        >
          {/* Subtle curved wave background */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full opacity-40 dark:opacity-20"
            preserveAspectRatio="none"
            viewBox="0 0 800 200"
            fill="none"
          >
            <path
              d="M0 160 C 200 130, 400 210, 600 110 C 700 60, 750 80, 800 65 L 800 200 L 0 200 Z"
              fill="url(#mintWaveGrad)"
            />
            <defs>
              <linearGradient id="mintWaveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a7f3d0" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#6ee7b7" stopOpacity="0.2" />
              </linearGradient>
            </defs>
          </svg>

          <div className="relative z-1 flex items-center justify-between gap-6">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-300">
                GRADER WORKSPACE
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#0d3829] sm:text-3xl lg:text-4xl dark:text-emerald-50">
                Welcome, {displayName}
              </h1>
              <p className="mt-2.5 max-w-xl text-sm font-medium leading-relaxed text-[#2d5a47] dark:text-emerald-200/90">
                Open a course to work on the tasks your teacher assigned.
                <br className="hidden sm:inline" /> Progress updates as you upload and enter marks.
              </p>
            </div>

            <img
              src={isDark ? welcomeArtDarkUrl : welcomeArtLightUrl}
              alt=""
              className={`pointer-events-none hidden h-28 w-auto shrink-0 select-none object-contain sm:block md:h-36 lg:h-44 ${
                isDark ? "mix-blend-lighten" : ""
              }`}
            />
          </div>
        </section>

        {/* Stats Row */}
        <div className="mt-6 grid w-full grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          {/* Courses Stat */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e8f8f0] text-[#16a34a] dark:bg-emerald-950/60 dark:text-emerald-400">
              <GraduationCapIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {stats.courses}
              </p>
              <p className="text-xs font-medium text-gray-500 sm:text-sm dark:text-gray-400">
                Courses
              </p>
            </div>
          </div>

          {/* Tasks Stat */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eff6ff] text-[#2563eb] dark:bg-blue-950/60 dark:text-blue-400">
              <ClipboardListIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {stats.tasks}
              </p>
              <p className="text-xs font-medium text-gray-500 sm:text-sm dark:text-gray-400">
                Tasks
              </p>
            </div>
          </div>

          {/* In Progress Stat */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f5f3ff] text-[#7c3aed] dark:bg-purple-950/60 dark:text-purple-400">
              <ClockIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {stats.inProgress}
              </p>
              <p className="text-xs font-medium text-gray-500 sm:text-sm dark:text-gray-400">
                In progress
              </p>
            </div>
          </div>
        </div>

        {/* Section Header */}
        <div className="mt-8 mb-6 sm:mt-10">
          <div className="relative inline-block">
            <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl dark:text-white">
              Assigned courses
            </h2>
            <div className="mt-1.5 h-1 w-12 rounded-full bg-[#10b981]" />
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Select a course to open your allowed tasks.
          </p>
        </div>

        {/* Course Cards Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#10b981]" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center shadow-xs dark:border-[#1b2c2e] dark:bg-[#0c181a]">
            <p className="text-base font-semibold text-gray-800 dark:text-gray-100">
              No assigned work yet
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
              When your teacher saves a task list for you, courses will appear here.
            </p>
          </div>
        ) : (
          <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6">
            {rows.map((row, index) => {
              const assigned = (row.tasks || []).filter((t) => t.assigned);
              const isEven = index % 2 === 0;

              return (
                <div
                  key={`${row.graderAllocationId}-${row.offeredCourseId}`}
                  className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs transition hover:border-emerald-200 hover:shadow-md dark:border-[#1b2c2e] dark:bg-[#0c181a] dark:hover:border-emerald-800/60"
                >
                  {/* Card Header */}
                  <div
                    onClick={() => navigateToCourse(row)}
                    className="flex cursor-pointer items-start justify-between gap-4"
                  >
                    <div className="flex min-w-0 items-start gap-3.5">
                      {/* Icon */}
                      <div
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${
                          isEven
                            ? "border-emerald-100/80 bg-[#eaf8f0] text-[#16a34a] dark:border-emerald-900/40 dark:bg-emerald-950/50 dark:text-emerald-400"
                            : "border-blue-100/80 bg-[#eff6ff] text-[#2563eb] dark:border-blue-900/40 dark:bg-blue-950/50 dark:text-blue-400"
                        }`}
                      >
                        <AtomIcon className="h-8 w-8" />
                      </div>

                      {/* Course Details */}
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold text-gray-900 transition group-hover:text-emerald-800 sm:text-lg dark:text-white dark:group-hover:text-emerald-300">
                          {row.courseTitle}
                        </h3>
                        <p className="mt-0.5 truncate text-xs font-medium text-gray-500 sm:text-sm dark:text-gray-400">
                          {row.courseCode} - {row.sectionName}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 sm:text-sm dark:text-gray-400">
                          <UserIcon className="h-3.5 w-3.5 text-gray-400" />
                          <span>Teacher: {row.teacherName}</span>
                        </p>
                      </div>
                    </div>

                    {/* Arrow Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateToCourse(row);
                      }}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f8f0] text-[#16a34a] transition hover:scale-105 hover:bg-[#d5f3e2] dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
                      aria-label="Open course menu"
                    >
                      <ChevronRightIcon className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Task Pills */}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {assigned.length === 0 ? (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        No tasks assigned
                      </span>
                    ) : (
                      assigned.map((task) => {
                        const check = checkTeacherTaskCompleteness(
                          task,
                          courseAssessments[row.offeredCourseId] || []
                        );
                        const isIncomplete = check.isIncomplete;
                        return (
                          <button
                            key={task.taskCode}
                            type="button"
                            onClick={() => navigateToTask(row, task)}
                            title={isIncomplete ? `Teacher setup pending: ${check.reason}` : task.label}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition hover:scale-[1.02] active:scale-[0.98] ${
                              isIncomplete
                                ? "border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900/50"
                                : "bg-[#e8f8f0] text-[#166534] hover:bg-[#d5f3e2] dark:bg-emerald-950/60 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
                            }`}
                          >
                            {isIncomplete && (
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            )}
                            <span>{task.label}</span>
                            {isIncomplete && (
                              <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                                (Teacher Pending)
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
