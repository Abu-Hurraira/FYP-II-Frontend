import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deduplicateHodCourses,
  enrichHodCoursesProgress,
  getHodDashboardCoursesPage,
  getOfferedCoursesFallbackPage,
} from "../../api/hodApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import DashboardWelcomeBanner from "../../components/DashboardWelcomeBanner.jsx";
import theme from "../../styles/theme";
import { folderStatusLabel, progressBarColor } from "../../utils/weeklyProgressHelpers";
import { showAlert } from "../../utils/dialogs";
import { getAuthDisplayName } from "../../utils/helpers";

const PAGE_SIZE = 12;

const AVATAR_PALETTES = [
  { gradient: "from-emerald-600 to-teal-500", bar: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]", text: "text-emerald-400" },
  { gradient: "from-purple-600 to-indigo-500", bar: "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]", text: "text-purple-400" },
  { gradient: "from-blue-600 to-cyan-500", bar: "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]", text: "text-blue-400" },
  { gradient: "from-amber-600 to-yellow-500", bar: "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]", text: "text-amber-400" },
  { gradient: "from-cyan-600 to-teal-500", bar: "bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]", text: "text-cyan-400" },
  { gradient: "from-pink-600 to-rose-500", bar: "bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]", text: "text-pink-400" },
];

function getPalette(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

function getInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function CourseMonitorCard({ course, onOpen, onWeekly }) {
  const pct = Math.round(course.weeklyProgressPercentage || 0);
  const status = folderStatusLabel(course);
  const isOpen = status === "Open";
  const initials = getInitials(course.teacherName || "Teacher");
  const palette = getPalette(course.teacherName || "");

  return (
    <article className="group relative flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-lg dark:border-[#1b2c2e] dark:bg-[#0d181a]">
      <div>
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Initials Avatar */}
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${palette.gradient} text-sm font-bold text-white shadow-sm`}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-gray-900 dark:text-white">
                {course.teacherName || "Teacher"}
              </h3>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                {course.sectionName || "Section"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                isOpen
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border dark:border-emerald-500/30"
                  : "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400 dark:border dark:border-blue-500/30"
              }`}
            >
              {status}
            </span>
            <button
              type="button"
              onClick={onOpen}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              title="Options"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Course Title */}
        <div className="mt-4">
          <h4 className="line-clamp-1 text-sm font-bold text-gray-800 dark:text-gray-200">
            {course.courseTitle || "Course Title"}
          </h4>
        </div>

        {/* Progress Bar & Percentage */}
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-end">
            <span className="text-xs font-extrabold text-gray-900 dark:text-gray-200">
              {pct}% <span className="font-normal text-gray-400">Progress</span>
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${palette.bar}`}
              style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-3.5 dark:border-gray-800/80">
        <button
          type="button"
          onClick={onWeekly}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 transition hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400"
        >
          <svg className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>CLOs & Weekly Content</span>
        </button>

        <button
          type="button"
          onClick={onOpen}
          className="flex items-center gap-1.5 rounded-xl bg-gray-100 px-3.5 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-emerald-600 hover:text-white dark:bg-[#122023] dark:text-gray-200 dark:border dark:border-[#1b2c2e] dark:hover:bg-emerald-600 dark:hover:text-white"
        >
          <span>View</span>
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </article>
  );
}

export default function HodWelcomeScreen() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState(() => {
    try {
      return sessionStorage.getItem("hodWelcomeSearch") || "";
    } catch {
      return "";
    }
  });
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [selectedProgram, setSelectedProgram] = useState("All Programs");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'

  const sentinelRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const requestIdRef = useRef(0);

  const displayName = getAuthDisplayName(user, "Head of Department");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    try {
      sessionStorage.setItem("hodWelcomeSearch", search);
    } catch {
      // Ignore storage issues
    }
  }, [search]);

  const mergeCourses = useCallback((existing, incoming) => {
    return deduplicateHodCourses([...(existing || []), ...(incoming || [])]);
  }, []);

  const loadPage = useCallback(
    async (nextPage, { replace = false, searchTerm = "" } = {}) => {
      const requestId = ++requestIdRef.current;

      if (replace) {
        setLoading(true);
        setHasMore(true);
      } else {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }

      try {
        let result;
        try {
          result = await getHodDashboardCoursesPage({
            page: nextPage,
            pageSize: PAGE_SIZE,
            search: searchTerm,
          });
        } catch {
          result = await getOfferedCoursesFallbackPage({
            page: nextPage,
            pageSize: PAGE_SIZE,
            search: searchTerm,
          });
        }

        if (requestId !== requestIdRef.current) return;

        setCourses((prev) => (replace ? result.items : mergeCourses(prev, result.items)));
        setPage(result.page);
        setHasMore(result.hasMore);
        setTotalCount(result.totalCount);

        const needsProgress = result.items.some((c) => c.progressLoading);
        if (needsProgress) {
          await enrichHodCoursesProgress(result.items, {
            concurrency: 3,
            onProgress: (updated) => {
              if (requestId !== requestIdRef.current) return;
              setCourses((prev) => {
                const byId = new Map(updated.map((c) => [c.offeredCourseId, c]));
                return prev.map((c) => byId.get(c.offeredCourseId) ?? c);
              });
            },
          });
        }
      } catch (error) {
        if (requestId === requestIdRef.current) {
          showAlert("Error", error.message);
          if (replace) {
            setCourses([]);
            setHasMore(false);
            setTotalCount(0);
          }
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
          loadingMoreRef.current = false;
        }
      }
    },
    [mergeCourses]
  );

  useEffect(() => {
    setCourses([]);
    setPage(0);
    loadPage(1, { replace: true, searchTerm: debouncedSearch });
  }, [debouncedSearch, loadPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || loading || !hasMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && hasMore && !loadingMoreRef.current) {
          loadPage(page + 1, { searchTerm: debouncedSearch });
        }
      },
      { root: null, rootMargin: "240px", threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, hasMore, page, debouncedSearch, loadPage]);

  // Program Filter Options
  const programOptions = useMemo(() => {
    const set = new Set(["All Programs"]);
    for (const c of courses) {
      if (c.programCode) set.add(c.programCode);
      else if (c.programName) set.add(c.programName);
      else if (c.sectionName?.includes("-")) set.add(c.sectionName.split("-")[0]);
    }
    return Array.from(set);
  }, [courses]);

  // Filtered Courses based on dropdowns
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      if (selectedProgram !== "All Programs") {
        const prog = c.programCode || c.programName || c.sectionName || "";
        if (!prog.toLowerCase().includes(selectedProgram.toLowerCase())) return false;
      }
      if (selectedStatus !== "All Status") {
        const st = folderStatusLabel(c);
        if (st.toLowerCase() !== selectedStatus.toLowerCase()) return false;
      }
      return true;
    });
  }, [courses, selectedProgram, selectedStatus]);

  return (
    <div className="min-h-full bg-page">
      <div className="w-full px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <DashboardWelcomeBanner name={displayName} />

        {/* Courses Section Header & Controls */}
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Courses</h2>
            <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
              Monitor teacher progress
              {!loading && totalCount > 0 ? ` · showing ${filteredCourses.length} of ${totalCount}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Buttons */}
            <div className="flex items-center rounded-xl border border-gray-200 bg-white p-1 dark:border-[#1b2c2e] dark:bg-[#0d181a]">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                  viewMode === "grid" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white"
                }`}
                title="Grid View"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2zM11 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                  viewMode === "list" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white"
                }`}
                title="List View"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Program Dropdown */}
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 outline-none dark:border-[#1b2c2e] dark:bg-[#0d181a] dark:text-gray-200"
            >
              {programOptions.map((opt) => (
                <option key={opt} value={opt} className="bg-white dark:bg-[#0d181a]">
                  {opt}
                </option>
              ))}
            </select>

            {/* Status Dropdown */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 outline-none dark:border-[#1b2c2e] dark:bg-[#0d181a] dark:text-gray-200"
            >
              <option value="All Status">All Status</option>
              <option value="Open">Open</option>
              <option value="Submitted">Submitted</option>
              <option value="Pending">Pending</option>
            </select>

            {/* Search Input */}
            <div className="w-full sm:w-64">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search teacher, section..."
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-[#1b2c2e] dark:bg-[#0d181a] dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Courses Cards List/Grid */}
        <div className="mt-5">
          {loading ? (
            <div className="flex justify-center py-20">
              <div
                className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
                style={{ borderTopColor: theme.colors.primary }}
              />
            </div>
          ) : (
            <>
              <div className={viewMode === "grid" ? "grid gap-5 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3"}>
                {filteredCourses.map((course) => (
                  <CourseMonitorCard
                    key={`${course.offeredCourseId}-${course.sectionName}-${course.courseTitle}`}
                    course={course}
                    onOpen={() => navigate(`/hod/offered-course/${course.offeredCourseId}/progress`)}
                    onWeekly={() => navigate(`/hod/offered-course/${course.offeredCourseId}/weekly`)}
                  />
                ))}
              </div>

              {filteredCourses.length === 0 && (
                <p className="py-16 text-center text-gray-500 dark:text-gray-400">
                  {debouncedSearch.trim() || selectedProgram !== "All Programs" || selectedStatus !== "All Status"
                    ? "No courses match your active search/filters."
                    : "No offered courses found. Add offered courses under Programs → Sessions."}
                </p>
              )}

              <div ref={sentinelRef} className="h-8 w-full" aria-hidden />

              {loadingMore && (
                <div className="flex justify-center py-6">
                  <div
                    className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
                    style={{ borderTopColor: theme.colors.primary }}
                  />
                </div>
              )}

              {!hasMore && filteredCourses.length > 0 && (
                <p className="py-4 text-center text-xs text-gray-400">All courses loaded</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
