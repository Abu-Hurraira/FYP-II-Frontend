import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getTeacherCourses } from "../../api/teacherApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import theme from "../../styles/theme";
import { showAlert } from "../../utils/dialogs";

import subjectIconUrl from "../../../assets/SubjectIcon.png";

function courseStatus(course) {
  const locked =
    course.isFolderLocked ??
    course.isLocked ??
    course.folderSubmitted ??
    course.isSubmitted ??
    false;
  return locked ? "Submitted" : "In Progress";
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

  const loadCourses = useCallback(async () => {
    if (!teacherUserId) {
      setLoading(false);
      return;
    }

    try {
      const data = await getTeacherCourses(teacherUserId);
      setCourses(data);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [teacherUserId]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const displayName =
    courses[0]?.teacherName || user?.fullName || user?.name || "Teacher";

  return (
    <div className="min-h-full bg-page">
      <div className="border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{displayName} Dashboard</h1>
            <p className="mt-0.5 text-xs text-gray-500">{displayName} courses</p>
          </div>
        </div>
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 pt-2">
            {courses.map((course) => {
              const pct = Math.round(course.weeklyProgressPercentage || 0);
              const status = courseStatus(course);
              const isSubmitted = status === "Submitted";

              return (
                <button
                  key={course.offeredCourseId}
                  type="button"
                  onClick={() =>
                    navigate(
                      `/teacher/course/${course.offeredCourseId}/menu?teacherUserId=${teacherUserId ?? ""}`
                    )
                  }
                  className="flex w-full flex-col rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <img
                        src={subjectIconUrl}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{course.courseTitle}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{course.sectionName}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={`rounded-lg px-3 py-1 text-xs font-bold ${
                          isSubmitted
                            ? "bg-blue-100 text-blue-800"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {status}
                      </span>
                      <span className="text-xl text-gray-300">›</span>
                    </div>
                  </div>

                  {course.hasWeeklyContent ? (
                    <div className="mt-4">
                      <div className="mb-2 flex justify-between text-xs">
                        <span className="text-gray-500">Progress</span>
                        <span className="font-bold text-gray-600">{pct}%</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(Math.max(pct, 0), 100)}%`,
                            backgroundColor: theme.colors.primary,
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
  );
}
