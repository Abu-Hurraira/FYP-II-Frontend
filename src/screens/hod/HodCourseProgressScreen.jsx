import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getTeacherSynchronization } from "../../api/teacherApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import theme from "../../styles/theme";
import { showAlert } from "../../utils/dialogs";
const COMPARE_COLORS = [
  "bg-pink-100 border-pink-200",
  "bg-emerald-100 border-emerald-200",
  "bg-amber-100 border-amber-200",
  "bg-sky-100 border-sky-200",
  "bg-violet-100 border-violet-200",
];

function teacherProgressFromMatrix(matrix, offeredCourseId) {
  if (!matrix?.length) return { covered: 0, total: 0, pct: 0 };

  let covered = 0;
  let total = 0;

  for (const row of matrix) {
    const status = (row.statuses ?? []).find((s) => s.offeredCourseId === offeredCourseId);
    if (!status) continue;
    total += 1;
    if (status.isCompleted) covered += 1;
  }

  const pct = total > 0 ? Math.round((covered / total) * 100) : 0;
  return { covered, total, pct };
}

export default function HodCourseProgressScreen() {
  const { offeredCourseId: oc } = useParams();
  const offeredCourseId = Number(oc);
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const result = await getTeacherSynchronization(offeredCourseId);
        setData(result);
      } catch (error) {
        showAlert("Error", error.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [offeredCourseId]);

  const currentTeacher = useMemo(
    () => (data?.teachers ?? []).find((t) => t.offeredCourseId === offeredCourseId),
    [data, offeredCourseId]
  );

  const currentProgress = useMemo(
    () => teacherProgressFromMatrix(data?.matrix ?? [], offeredCourseId),
    [data, offeredCourseId]
  );

  const otherTeachers = useMemo(
    () => (data?.teachers ?? []).filter((t) => t.offeredCourseId !== offeredCourseId),
    [data, offeredCourseId]
  );

  const courseTitle = data?.courseTitle || "Course";

  return (
    <div className="relative min-h-full bg-page pb-24">
      <div className="border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start gap-3">
          <PageBackButton className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-gray-900">Teacher Progress</h1>
            <p className="mt-0.5 text-xs text-gray-500">{courseTitle}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div
            className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
            style={{ borderTopColor: theme.colors.primary }}
          />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-lg font-bold text-gray-900">
              {currentTeacher?.teacherName || data?.currentTeacherName || "Teacher"}
            </p>
            <p className="mt-0.5 text-sm text-gray-500">
              {currentTeacher?.sectionName || data?.currentSectionName || ""}
            </p>

            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-2xl font-extrabold text-gray-900">
                  {currentProgress.covered}/{currentProgress.total || "—"} Topics
                </p>
                <p className="mt-1 text-sm font-semibold text-brand">{currentProgress.pct}% complete</p>
              </div>
            </div>

            <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(Math.max(currentProgress.pct, 0), 100)}%`,
                  backgroundColor: theme.colors.primary,
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => navigate(`/hod/offered-course/${offeredCourseId}/weekly`)}
              className="mt-5 w-full rounded-lg border border-brand/30 bg-brand-muted py-2.5 text-sm font-semibold text-brand-dark transition hover:bg-brand-light"
            >
              View weekly topic status
            </button>
          </div>

          {otherTeachers.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-sm font-semibold text-gray-600">
                Other sections teaching this subject (all programs)
              </p>
              <div className="flex flex-col gap-3">
                {otherTeachers.map((teacher, index) => {
                  const progress = teacherProgressFromMatrix(data?.matrix ?? [], teacher.offeredCourseId);
                  const color = COMPARE_COLORS[index % COMPARE_COLORS.length];

                  return (
                    <button
                      key={teacher.offeredCourseId}
                      type="button"
                      onClick={() => navigate(`/hod/offered-course/${teacher.offeredCourseId}/progress`)}
                      className={`flex w-full items-center justify-between rounded-xl border p-4 text-left shadow-sm transition hover:opacity-90 ${color}`}
                    >
                      <div>
                        <p className="font-bold text-gray-900">{teacher.teacherName}</p>
                        <p className="text-xs text-gray-600">{teacher.sectionName}</p>
                      </div>
                      <p className="text-lg font-extrabold text-gray-800">
                        {progress.covered}/{progress.total || "—"} Topics
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {otherTeachers.length === 0 && (
            <p className="mt-8 text-center text-sm text-gray-500">
              No other sections are teaching this course for comparison.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
