import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getOfferedCourseUploadPermissions } from "../../api/hodUploadAllocationApi";
import { getCourseMenu } from "../../api/teacherApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert } from "../../utils/dialogs";
import { canManageClosFromPermissions } from "../../utils/uploadAllocationHelpers";

import weeklyUrl from "../../../assets/WeeklyContentIcon.png";
import closUrl from "../../../assets/CLOs.png";

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
  const [loading, setLoading] = useState(true);

  const canManageClos = canManageClosFromPermissions(uploadPermissions);

  const loadCourse = useCallback(async () => {
    try {
      const [data, permissions] = await Promise.all([
        getCourseMenu(offeredCourseId),
        getOfferedCourseUploadPermissions(offeredCourseId).catch(() => ({
          clos: false,
          configured: false,
        })),
      ]);
      setCourse(data);
      setUploadPermissions(permissions);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [offeredCourseId]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  const courseTitleQs = encodeURIComponent(course?.courseTitle || "");
  const teacherQs = `teacherUserId=${teacherUserId ?? ""}&courseTitle=${courseTitleQs}`;

  const items = [
    {
      title: "Weekly Content",
      icon: weeklyUrl,
      disabled: false,
      onPress: () =>
        navigate(`/teacher/course/${offeredCourseId}/weekly-content?${teacherQs}`),
    },
    {
      title: "CLOs",
      icon: closUrl,
      // Card stays openable for all teachers (shared view). Add/upload is gated on the CLO screen.
      // Visual cue: subtitle differs when this teacher cannot manage CLOs.
      disabled: false,
      subtitle: canManageClos
        ? "Save drafts, then Upload for HOD approval"
        : "Approved CLOs only (hidden until HOD approves)",
      onPress: () => navigate(`/teacher/course/${offeredCourseId}/clos?${teacherQs}`),
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
      </div>
    );
  }

  const subtitle = course?.teacherName || user?.fullName || user?.name || "Teacher";

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-gray-900">{course?.courseTitle || "Course"}</h1>
          <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
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
              className="flex min-h-[72px] items-center rounded-2xl border border-gray-100 bg-white px-5 py-4 text-left shadow-card shadow-sm transition hover:bg-brand-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <img
                src={item.icon}
                alt=""
                className="mr-4 h-12 w-12 shrink-0 rounded-xl object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-gray-900">{item.title}</span>
                {item.subtitle ? (
                  <span className="mt-0.5 block text-xs text-gray-500">{item.subtitle}</span>
                ) : null}
              </span>
              <span className="text-2xl text-gray-300">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
