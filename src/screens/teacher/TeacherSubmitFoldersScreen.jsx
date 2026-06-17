import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { enrichCoursesWithFolderReview, getAllTeacherCourses } from "../../api/teacherApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert } from "../../utils/dialogs";
import theme from "../../styles/theme";
import {
  teacherFolderStatusBadgeClass,
  teacherFolderSubmissionStatus,
} from "../../utils/weeklyProgressHelpers";
export default function TeacherSubmitFoldersScreen() {
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const fromQuery = searchParams.get("teacherUserId");
  const teacherUserId =
    fromQuery != null && fromQuery !== "" ? Number(fromQuery) || user?.userId : user?.userId;

  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCourses = useCallback(async () => {
    if (!teacherUserId) {
      setLoading(false);
      return;
    }

    try {
      const result = await getAllTeacherCourses(teacherUserId);
      const enriched = await enrichCoursesWithFolderReview(result);
      setCourses(enriched);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [teacherUserId]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Submit folders</h1>
          <p className="mt-0.5 text-xs text-gray-500">{user?.fullName || user?.name || "Teacher"}</p>
          <p className="mt-2 text-sm text-gray-600">
            Upload files to any of your sections. No HOD permission is required. A section locks only
            after you submit it and HOD approves it.
          </p>
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
            {courses.map((item) => {
              const status = teacherFolderSubmissionStatus(item);
              return (
              <button
                key={item.offeredCourseId}
                type="button"
                onClick={() =>
                  navigate(
                    `/teacher/course/${item.offeredCourseId}/folder?teacherUserId=${teacherUserId ?? ""}`,
                    { state: { folderStatus: status } }
                  )
                }
                className="flex min-h-[48px] items-center rounded-lg border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {item.courseTitle} — {item.sectionName}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${teacherFolderStatusBadgeClass(status)}`}
                  >
                    {status}
                  </span>
                </div>
                <span className="shrink-0 text-xl text-gray-300">›</span>
              </button>
            );
            })}
            {courses.length === 0 && (
              <p className="py-16 text-center text-sm text-gray-500">
                No courses assigned to you yet.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
