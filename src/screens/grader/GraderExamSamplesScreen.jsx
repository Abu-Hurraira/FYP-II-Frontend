import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getGraderTasksMine } from "../../api/graderTasksApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert } from "../../utils/dialogs";

const EXAM_OPTIONS = [
  {
    key: "mid",
    title: "Mid exam samples",
    subtitle: "Upload Best / Average / Worst for Mid",
    path: (oc, qs) => `/grader/course/${oc}/mid-exams?${qs}&focus=samples`,
  },
  {
    key: "final",
    title: "Final exam samples",
    subtitle: "Upload Best / Average / Worst for Final",
    path: (oc, qs) => `/grader/course/${oc}/final-exams?${qs}&focus=samples`,
  },
];

export default function GraderExamSamplesScreen() {
  const { offeredCourseId: ocParam } = useParams();
  const offeredCourseId = Number(ocParam);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const teacherUserId = searchParams.get("teacherUserId") || "";
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getGraderTasksMine();
        const match = rows.find((r) => Number(r.offeredCourseId) === offeredCourseId);
        if (!cancelled) setCourse(match || null);
        const allowed = (match?.tasks || []).some(
          (t) => t.assigned && String(t.taskCode).toLowerCase() === "examsamples"
        );
        if (!match || !allowed) {
          showAlert("No access", "Exam samples are not assigned for this course.");
          navigate(`/grader/course/${offeredCourseId}/menu?teacherUserId=${teacherUserId}`, {
            replace: true,
          });
        }
      } catch (error) {
        if (!cancelled) showAlert("Error", error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [offeredCourseId, navigate, teacherUserId]);

  const qs = `teacherUserId=${teacherUserId || course?.teacherUserId || ""}`;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-4 sm:px-6 lg:px-8 dark:border-[#1b2c2e] dark:bg-[#071113]">
        <PageBackButton className="mt-0.5" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Exam samples</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            {course?.courseCode} · {course?.sectionName} · {course?.courseTitle}
          </p>
        </div>
      </div>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Choose Mid or Final. You only upload sample papers here — marks setup is not required.
        </p>
        <div className="flex flex-col gap-3 w-full">
          {EXAM_OPTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => navigate(item.path(offeredCourseId, qs))}
              className="flex min-h-[76px] items-center rounded-2xl border border-gray-100 bg-white px-5 py-4 text-left shadow-sm transition hover:border-emerald-300/70 hover:bg-emerald-50/40 dark:border-[#1b2c2e] dark:bg-[#0c181a]"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-gray-900 dark:text-white">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">{item.subtitle}</span>
              </span>
              <span className="text-2xl font-bold text-gray-300">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
