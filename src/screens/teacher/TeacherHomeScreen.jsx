import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { enrichCoursesWithFolderReview, enrichCoursesWithSharedWeeklyContent, getAllTeacherCourses } from "../../api/teacherApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import DashboardWelcomeBanner from "../../components/DashboardWelcomeBanner.jsx";
import theme from "../../styles/theme";
import { showAlert } from "../../utils/dialogs";
import {
  teacherFolderStatusBadgeClass,
  teacherFolderSubmissionStatus,
} from "../../utils/weeklyProgressHelpers";
import { getAuthDisplayName } from "../../utils/helpers";

import subjectIconUrl from "../../../assets/SubjectIcon.png";

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

  const loadCourses = useCallback(async () => {
    if (!teacherUserId) {
      setLoading(false);
      return;
    }

    try {
      const data = await getAllTeacherCourses(teacherUserId);
      const enriched = await enrichCoursesWithFolderReview(data);
      const withWeekly = await enrichCoursesWithSharedWeeklyContent(enriched);
      setCourses(withWeekly);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [teacherUserId]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const displayName = getAuthDisplayName(user, "Teacher");

  return (
    <div className="min-h-full bg-page">
      <div className="w-full px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <DashboardWelcomeBanner name={displayName} />

        <div className="mt-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {courses.map((course) => {
              const pct = Math.round(course.weeklyProgressPercentage || 0);
              const status = teacherFolderSubmissionStatus(course);

              return (
                <button
                  key={course.offeredCourseId}
                  type="button"
                  onClick={() =>
                    navigate(
                      `/teacher/course/${course.offeredCourseId}/menu?teacherUserId=${teacherUserId ?? ""}`
                    )
                  }
                  className="app-card flex w-full flex-col p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                        style={{ backgroundColor: "var(--brand-light)" }}
                      >
                        <img
                          src={subjectIconUrl}
                          alt=""
                          className="h-7 w-7 object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{course.courseTitle}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{course.sectionName}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${teacherFolderStatusBadgeClass(status)}`}
                      >
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
            })}

            {courses.length === 0 && (
              <p className="py-16 text-center text-gray-500">
                No courses assigned to this teacher yet.
              </p>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
