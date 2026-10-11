import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getTeacherCoursesPage } from "../../api/teacherApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import DashboardWelcomeBanner from "../../components/DashboardWelcomeBanner.jsx";
import { showAlert } from "../../utils/dialogs";
import {
  teacherFolderStatusBadgeClass,
  teacherFolderSubmissionStatus,
} from "../../utils/weeklyProgressHelpers";
import { getAuthDisplayName } from "../../utils/helpers";

import subjectIconUrl from "../../../assets/SubjectIcon.png";

const PAGE_SIZE = 12;

function CourseCardSkeleton() {
  return (
    <div className="app-card flex w-full animate-pulse flex-col p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-gray-200" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-2/3 rounded bg-gray-200" />
            <div className="mt-2 h-3 w-1/3 rounded bg-gray-100" />
          </div>
        </div>
        <div className="h-6 w-20 rounded-full bg-gray-200" />
      </div>
      <div className="mt-4 h-2 w-full rounded-full bg-gray-100" />
    </div>
  );
}

function CourseCard({ course, onOpen }) {
  const pct = Math.round(course.weeklyProgressPercentage || 0);
  const status = teacherFolderSubmissionStatus(course);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="app-card flex w-full flex-col p-4 text-left"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "var(--brand-light)" }}
          >
            <img src={subjectIconUrl} alt="" className="h-7 w-7 object-contain" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{course.courseTitle}</p>
            <p className="mt-0.5 text-xs text-gray-500">{course.sectionName}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${teacherFolderStatusBadgeClass(status)}`}>
            {status}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-lg text-gray-400">
            ›
          </span>
        </div>
      </div>

      {course.hasWeeklyContent ? (
        <div className="mt-4">
          <div className="mb-2 flex justify-between text-xs">
            <span className="text-gray-500">Progress</span>
            <span className="font-bold" style={{ color: "var(--brand)" }}>
              {pct}%
            </span>
          </div>
          <div className="app-progress-track">
            <div
              className="app-progress-fill"
              style={{
                width: `${Math.min(Math.max(Number(pct) || 0, 0), 100)}%`,
              }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500">Weekly content not uploaded yet</p>
      )}
    </button>
  );
}

export default function TeacherHomeScreen() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const teacherUserIdParam = searchParams.get("teacherUserId");

  const teacherUserId =
    teacherUserIdParam != null && teacherUserIdParam !== ""
      ? Number(teacherUserIdParam) || user?.userId
      : user?.userId;

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const sentinelRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const requestIdRef = useRef(0);

  const displayName = getAuthDisplayName(user, "Teacher");

  const loadPage = useCallback(
    async (nextPage, { replace = false } = {}) => {
      if (!teacherUserId) {
        setLoading(false);
        setHasMore(false);
        return;
      }

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
        const result = await getTeacherCoursesPage({
          teacherUserId,
          page: nextPage,
          pageSize: PAGE_SIZE,
        });

        if (requestId !== requestIdRef.current) return;

        setCourses((prev) => {
          if (replace) return result.items;
          const seen = new Set(prev.map((c) => c.offeredCourseId));
          return [...prev, ...result.items.filter((c) => !seen.has(c.offeredCourseId))];
        });
        setPage(result.page);
        setHasMore(result.hasMore);
      } catch (error) {
        if (requestId === requestIdRef.current) {
          showAlert("Error", error.message);
          if (replace) {
            setCourses([]);
            setHasMore(false);
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
    [teacherUserId]
  );

  useEffect(() => {
    setCourses([]);
    setPage(0);
    loadPage(1, { replace: true });
  }, [loadPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || loading || !hasMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && hasMore && !loadingMoreRef.current) {
          loadPage(page + 1);
        }
      },
      { root: null, rootMargin: "240px", threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, hasMore, page, loadPage]);

  return (
    <div className="min-h-full bg-page">
      <div className="w-full px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <DashboardWelcomeBanner name={displayName} />

        <div className="mt-4">
          {loading ? (
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 6 }, (_, i) => (
                <CourseCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {courses.map((course) => (
                <CourseCard
                  key={course.offeredCourseId}
                  course={course}
                  onOpen={() =>
                    navigate(
                      `/teacher/course/${course.offeredCourseId}/menu?teacherUserId=${teacherUserId ?? ""}`
                    )
                  }
                />
              ))}

              {courses.length === 0 && (
                <p className="py-16 text-center text-gray-500">
                  No courses assigned to this teacher yet.
                </p>
              )}

              <div ref={sentinelRef} className="h-8 w-full" aria-hidden />

              {loadingMore && (
                <div className="flex flex-col gap-2.5">
                  {Array.from({ length: 3 }, (_, i) => (
                    <CourseCardSkeleton key={`more-${i}`} />
                  ))}
                </div>
              )}

              {!hasMore && courses.length > 0 && (
                <p className="py-3 text-center text-xs text-gray-400">All courses loaded</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
