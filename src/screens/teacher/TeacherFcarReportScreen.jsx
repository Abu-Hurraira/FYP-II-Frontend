import React, { useContext } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import FcarGeneratorView from "../../components/FcarGeneratorView.jsx";
import { getAuthUserId } from "../../utils/helpers";

export default function TeacherFcarReportScreen() {
  const { user } = useContext(AuthContext);
  const teacherUserId = getAuthUserId(user);
  const { offeredCourseId: ocParam } = useParams();
  const offeredCourseId = Number(ocParam);
  const [searchParams] = useSearchParams();
  const courseTitle = searchParams.get("courseTitle") || "";

  return (
    <div className="relative min-h-full bg-page pb-12">
      <div className="border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8 dark:border-[#1b2c2e] dark:bg-[#071113]">
        <div className="flex min-w-0 items-center gap-3">
          <PageBackButton className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-gray-900 dark:text-white">Generate FCAR</h1>
            <p className="mt-0.5 text-xs text-gray-500">{courseTitle || "Faculty Course Assessment Report"}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <FcarGeneratorView
          offeredCourseId={offeredCourseId}
          teacherUserId={teacherUserId}
        />
      </div>
    </div>
  );
}
