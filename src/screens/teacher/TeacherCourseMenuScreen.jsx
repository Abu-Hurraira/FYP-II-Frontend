import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getOfferedCourseUploadPermissions } from "../../api/hodUploadAllocationApi";
import { getCourseMenu } from "../../api/teacherApi";
import { getCourseFixedScheme } from "../../api/courseResultsApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert } from "../../utils/dialogs";
import { canManageClosFromPermissions, canManageMidFromPermissions, canManageFinalFromPermissions } from "../../utils/uploadAllocationHelpers";

export default function TeacherCourseMenuScreen() {
  const { user } = useContext(AuthContext);
  const { offeredCourseId: ocParam } = useParams();
  const offeredCourseId = Number(ocParam);
  const [searchParams] = useSearchParams();
  const routeTeacher = searchParams.get("teacherUserId");
  const teacherUserId =
    routeTeacher != null && routeTeacher !== ""
      ? Number(routeTeacher) || user?.userId
      : user?.userId;

  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [uploadPermissions, setUploadPermissions] = useState(null);
  const [hasLab, setHasLab] = useState(false);
  const [loading, setLoading] = useState(true);

  const canManageClos = canManageClosFromPermissions(uploadPermissions);
  const canManageMid = canManageMidFromPermissions(uploadPermissions);
  const canManageFinal = canManageFinalFromPermissions(uploadPermissions);

  const loadCourse = useCallback(async () => {
    try {
      const [data, permissions, scheme] = await Promise.all([
        getCourseMenu(offeredCourseId),
        getOfferedCourseUploadPermissions(offeredCourseId, teacherUserId).catch(() => ({
          clos: false,
          configured: false,
        })),
        getCourseFixedScheme(offeredCourseId, teacherUserId).catch(() => null),
      ]);
      setCourse(data);
      setUploadPermissions(permissions);
      setHasLab(Boolean(scheme?.hasLab ?? scheme?.HasLab ?? scheme?.fixed?.hasLab ?? scheme?.Fixed?.HasLab));
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [offeredCourseId, teacherUserId]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  const courseTitleQs = encodeURIComponent(course?.courseTitle || "");
  const teacherQs = `teacherUserId=${teacherUserId ?? ""}&courseTitle=${courseTitleQs}`;

  const items = [
    {
      title: "Weekly Content",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      disabled: false,
      onPress: () =>
        navigate(`/teacher/course/${offeredCourseId}/weekly-content?${teacherQs}`),
    },
    {
      title: "Assignments",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      disabled: false,
      onPress: () =>
        navigate(`/teacher/course/${offeredCourseId}/assignments?${teacherQs}`),
    },
    {
      title: "Quizzes",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      ),
      disabled: false,
      onPress: () =>
        navigate(`/teacher/course/${offeredCourseId}/quizzes?${teacherQs}`),
    },
    {
      title: "Mid Term Exams",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h3m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2 2" />
        </svg>
      ),
      disabled: false,
      subtitle: canManageMid
        ? "Design the paper, then Upload for HOD approval"
        : "Approved paper only (shared after HOD approves)",
      onPress: () =>
        navigate(`/teacher/course/${offeredCourseId}/mid-exams?${teacherQs}`),
    },
    {
      title: "Final Term Exams",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        </svg>
      ),
      disabled: false,
      subtitle: canManageFinal
        ? "Design the paper, then Upload for HOD approval"
        : "Approved paper only (shared after HOD approves)",
      onPress: () =>
        navigate(`/teacher/course/${offeredCourseId}/final-exams?${teacherQs}`),
    },
    {
      title: "Assessment",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      disabled: false,
      onPress: () =>
        navigate(`/teacher/course/${offeredCourseId}/assessment?${teacherQs}`),
    },
    {
      title: "CLO/PLO attainment",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      disabled: false,
      onPress: () =>
        navigate(`/teacher/course/${offeredCourseId}/results?${teacherQs}`),
    },
    {
      title: "Course Result",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M7 6h10M7 18h10" />
        </svg>
      ),
      disabled: false,
      onPress: () =>
        navigate(`/teacher/course/${offeredCourseId}/course-result?${teacherQs}`),
    },
    {
      title: "Component Marks",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m-6 4h6m-6 4h4M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
        </svg>
      ),
      disabled: false,
      onPress: () =>
        navigate(`/teacher/course/${offeredCourseId}/component-marks?${teacherQs}`),
    },
    {
      title: "CLOs",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      disabled: false,
      subtitle: canManageClos
        ? "Save drafts, then Upload for HOD approval"
        : "Approved CLOs only (hidden until HOD approves)",
      onPress: () => navigate(`/teacher/course/${offeredCourseId}/clos?${teacherQs}`),
    },
    {
      title: "Mappings",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      disabled: false,
      subtitle: hasLab
        ? "CLO-PLO, homework marks, and lab marks"
        : "CLO-PLO and homework marks",
      onPress: () => navigate(`/teacher/course/${offeredCourseId}/mappings?${teacherQs}`),
    },
    {
      title: "FCAR Report",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      disabled: false,
      subtitle: "Real-time Faculty Course Assessment Report & live outcome analysis",
      onPress: () => navigate(`/teacher/course/${offeredCourseId}/fcar-report?${teacherQs}`),
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand dark:border-gray-800 dark:border-t-brand" />
      </div>
    );
  }

  const subtitle = course?.teacherName || user?.fullName || user?.name || "Teacher";

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8 dark:border-[#1b2c2e] dark:bg-[#071113]">
        <PageBackButton className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-gray-900 dark:text-white">
            {course?.courseTitle || "Course"}
          </h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 pt-2">
          {items.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={item.onPress}
              disabled={item.disabled}
              className="group flex min-h-[72px] items-center rounded-2xl border border-gray-100 bg-white px-5 py-4 text-left shadow-card shadow-sm transition hover:border-emerald-500/30 hover:bg-brand-muted/40 dark:border-[#1b2c2e] dark:bg-[#0c181a] dark:hover:border-emerald-500/30 dark:hover:bg-[#122225] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="mr-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#dcfce7] text-[#15803d] transition group-hover:bg-[#bbf7d0] dark:bg-[#153e2e] dark:text-[#34d399] dark:group-hover:bg-[#1a4a37]">
                {item.icon}
              </div>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-extrabold text-gray-900 dark:text-white">
                  {item.title}
                </span>
                {item.subtitle ? (
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                    {item.subtitle}
                  </span>
                ) : null}
              </span>
              <span className="text-2xl font-bold text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600 dark:text-gray-600 dark:group-hover:text-emerald-400">
                ›
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
