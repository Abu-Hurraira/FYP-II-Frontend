import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getCourseMenu } from "../../api/teacherApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert } from "../../utils/dialogs";

import weeklyUrl from "../../../assets/WeeklyContentIcon.png";
import attUrl from "../../../assets/AttendanceIcon.png";
import assignUrl from "../../../assets/AssignmentIcon.png";
import quizUrl from "../../../assets/QuizzesIcon.png";
import resUrl from "../../../assets/Results.png";
import lessonUrl from "../../../assets/LessonsPlans.png";
import cloUrl from "../../../assets/CLOs.png";

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
  const [loading, setLoading] = useState(true);

  const loadCourse = useCallback(async () => {
    try {
      const data = await getCourseMenu(offeredCourseId);
      setCourse(data);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [offeredCourseId]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  const items = [
    {
      title: "Weekly Content",
      icon: weeklyUrl,
      onPress: () =>
        navigate(
          `/teacher/course/${offeredCourseId}/weekly-content?teacherUserId=${teacherUserId ?? ""}&courseTitle=${encodeURIComponent(course?.courseTitle || "")}`
        ),
    },
    // {
    //   title: "Attendance",
    //   icon: attUrl,
    //   onPress: () => navigate("/teacher/placeholder?title=Attendance"),
    // },
    // {
    //   title: "Assignments",
    //   icon: assignUrl,
    //   onPress: () => navigate("/teacher/placeholder?title=Assignments"),
    // },
    // {
    //   title: "Quizzes",
    //   icon: quizUrl,
    //   onPress: () => navigate("/teacher/placeholder?title=Quizzes"),
    // },
    // {
    //   title: "Results",
    //   icon: resUrl,
    //   onPress: () => navigate("/teacher/placeholder?title=Results"),
    // },
    // {
    //   title: "Lesson Plans",
    //   icon: lessonUrl,
    //   onPress: () => navigate("/teacher/placeholder?title=Lesson Plans"),
    // },
    // {
    //   title: "CLOs",
    //   icon: cloUrl,
    //   onPress: () => navigate("/teacher/placeholder?title=CLOs"),
    // },
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
        <div className="flex flex-col gap-2.5 pt-2">
          {items.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={item.onPress}
              className="flex min-h-[52px] items-center rounded-lg border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-gray-50"
            >
              <img src={item.icon} alt="" className="mr-3 h-10 w-10 shrink-0 rounded-lg object-cover" />
              <span className="flex-1 text-left text-sm font-semibold text-gray-900">{item.title}</span>
              <span className="text-xl text-gray-300">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
