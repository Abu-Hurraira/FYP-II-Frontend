import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deduplicateHodCourses,
  enrichHodCoursesProgress,
  getHodDashboardCoursesList,
} from "../../api/hodApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import theme from "../../styles/theme";
import { folderStatusLabel, progressBarColor } from "../../utils/weeklyProgressHelpers";
import { showAlert } from "../../utils/dialogs";

function CourseMonitorCard({ course, onOpen, onWeekly }) {
  const pct = Math.round(course.weeklyProgressPercentage || 0);
  const status = folderStatusLabel(course);
  const isOpen = status === "Open";
  const total = course.totalTopics ?? 0;
  const covered = course.coveredTopics ?? 0;
  const deviation = course.deviationTopics ?? Math.max(0, total - covered);
  const sectionCourse = [course.sectionName, course.courseTitle].filter(Boolean).join(", ");

  return (
    <article className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow-md">
      <button type="button" onClick={onOpen} className="flex w-full flex-col text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-bold text-gray-900">{course.teacherName || "Teacher"}</p>
            <p className="mt-1 text-sm text-gray-600">{sectionCourse || "—"}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
              isOpen ? "bg-brand-light text-brand-dark" : "bg-blue-100 text-blue-800"
            }`}
          >
            {status}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
          <span className="text-xs font-semibold text-gray-600">CLOs and Weekly Content</span>
          <span
            role="presentation"
            onClick={(e) => {
              e.stopPropagation();
              onWeekly();
            }}
            className="cursor-pointer rounded-md bg-pink-100 px-2.5 py-1 text-xs font-bold text-pink-700 transition hover:bg-pink-200"
          >
            View
          </span>
        </div>

        {course.progressLoading ? (
          <div className="mt-4 animate-pulse">
            <div className="mb-2 h-8 w-16 rounded bg-gray-200" />
            <div className="h-2.5 w-full rounded-full bg-gray-200" />
            <p className="mt-2 text-xs text-gray-400">Loading progress…</p>
          </div>
        ) : course.hasWeeklyContent ? (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-2xl font-extrabold text-gray-900">{pct}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(Math.max(pct, 0), 100)}%`,
                  backgroundColor: progressBarColor(pct),
                }}
              />
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">Weekly content not uploaded yet</p>
        )}
      </button>

      {!course.progressLoading && course.hasWeeklyContent && (
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs font-semibold text-gray-500">
          <span>
            Covered {covered}/{total} Topics
          </span>
          <span>Deviation: {deviation} Topics</span>
        </div>
      )}
    </article>
  );
}

export default function HodWelcomeScreen() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => {
    try {
      return sessionStorage.getItem("hodWelcomeSearch") || "";
    } catch {
      return "";
    }
  });

  const displayName = user?.fullName || user?.name || "Head of Department";

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const list = await getHodDashboardCoursesList();
        if (cancelled) return;
        setCourses(deduplicateHodCourses(list));
        setLoading(false);

        const needsProgress = list.some((c) => c.progressLoading);
        if (!needsProgress) {
          setCourses(deduplicateHodCourses(list));
          return;
        }

        await enrichHodCoursesProgress(list, {
          concurrency: 4,
          onProgress: (updated) => {
            if (!cancelled) setCourses(deduplicateHodCourses(updated));
          },
        });
      } catch (error) {
        if (!cancelled) {
          showAlert("Error", error.message);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem("hodWelcomeSearch", search);
    } catch {
      // Ignore storage issues (private mode, etc.)
    }
  }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => {
      const hay = [
        c.teacherName,
        c.sectionName,
        c.courseTitle,
        c.courseCode,
        c.programName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [courses, search]);

  return (
    <div className="min-h-full bg-page">
      <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Courses</h1>
            <p className="mt-0.5 text-sm text-gray-500">{displayName}</p>
          </div>
          <div className="w-full sm:w-72">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teacher, section, course…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>
      </div>

      <div className="w-full px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((course) => (
                <CourseMonitorCard
                  key={`${course.offeredCourseId}-${course.sectionName}-${course.courseTitle}`}
                  course={course}
                  onOpen={() => navigate(`/hod/offered-course/${course.offeredCourseId}/progress`)}
                  onWeekly={() => navigate(`/hod/offered-course/${course.offeredCourseId}/weekly`)}
                />
              ))}
            </div>

            {filtered.length === 0 && (
              <p className="py-16 text-center text-gray-500">
                {courses.length === 0
                  ? "No offered courses found. Add offered courses under Programs → Sessions."
                  : "No courses match your search."}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
