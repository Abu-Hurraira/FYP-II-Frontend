import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  getAssessmentMarksSheet,
  saveAssessmentMarksSheet,
} from "../../api/cloAttainmentApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert } from "../../utils/dialogs";

function formatNumber(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const rounded = Math.round(Number(value) * 100) / 100;
  return String(rounded);
}

function cleanAssessmentTitle(title, typeName, assessmentNo) {
  let text = String(title || "")
    .replace(/â€"|â€”|â€“|Ã¢â‚¬â€œ/g, "–")
    .replace(/\s+/g, " ")
    .trim();
  const prefix = new RegExp(`^${typeName || "\\w+"}\\s*${assessmentNo ?? "\\d*"}\\b`, "i");
  for (let i = 0; i < 2; i += 1) {
    text = text.replace(prefix, "").replace(/^[^A-Za-z0-9]+/, "").trim();
  }
  return text;
}

function normalizeSheet(raw) {
  if (!raw) return null;
  const questions = (raw.questions ?? raw.Questions ?? []).map((q) => ({
    questionId: q.questionId ?? q.QuestionId,
    questionNo: q.questionNo ?? q.QuestionNo ?? "",
    maxMarks: Number(q.maxMarks ?? q.MaxMarks) || 0,
  }));
  const students = (raw.students ?? raw.Students ?? []).map((s) => ({
    studentId: s.studentId ?? s.StudentId,
    fullName: s.fullName ?? s.FullName ?? "",
    aridNo: s.aridNo ?? s.AridNo ?? "",
    marksByQuestionId: s.marksByQuestionId ?? s.MarksByQuestionId ?? {},
  }));
  return {
    assessmentTitle: raw.assessmentTitle ?? raw.AssessmentTitle ?? "",
    assessmentTypeName: raw.assessmentTypeName ?? raw.AssessmentTypeName ?? "",
    assessmentNo: raw.assessmentNo ?? raw.AssessmentNo,
    totalMarks: raw.totalMarks ?? raw.TotalMarks,
    isSetupComplete: Boolean(raw.isSetupComplete ?? raw.IsSetupComplete),
    questions,
    students,
  };
}

export default function TeacherAssessmentMarksScreen() {
  const { user } = useContext(AuthContext);
  const { offeredCourseId: ocParam, assessmentId: aParam } = useParams();
  const offeredCourseId = Number(ocParam);
  const assessmentId = Number(aParam);
  const [searchParams] = useSearchParams();
  const routeTeacher = searchParams.get("teacherUserId");
  const teacherUserId =
    routeTeacher != null && routeTeacher !== ""
      ? Number(routeTeacher) || user?.userId
      : user?.userId;
  const [sheet, setSheet] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const applySheet = (data) => {
    const next = normalizeSheet(data);
    setSheet(next);
    const values = {};
    (next?.students || []).forEach((student) => {
      Object.entries(student.marksByQuestionId || {}).forEach(([questionId, value]) => {
        values[`${student.studentId}|${questionId}`] = value == null ? "" : String(value);
      });
    });
    setDraft(values);
  };

  const loadSheet = useCallback(async () => {
    try {
      setLoading(true);
      applySheet(await getAssessmentMarksSheet(assessmentId, offeredCourseId, teacherUserId));
    } catch (error) {
      showAlert("Marks", error.message);
    } finally {
      setLoading(false);
    }
  }, [assessmentId, offeredCourseId, teacherUserId]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  const questions = sheet?.questions || [];
  const headerLabel = sheet
    ? `${sheet.assessmentTypeName}${sheet.assessmentNo != null ? ` ${sheet.assessmentNo}` : ""}`.trim()
    : "";
  const headerTitle = sheet
    ? cleanAssessmentTitle(sheet.assessmentTitle, sheet.assessmentTypeName, sheet.assessmentNo)
    : "";
  const assessmentTotal =
    Number(sheet?.totalMarks) > 0
      ? Number(sheet.totalMarks)
      : questions.reduce((sum, q) => sum + (Number(q.maxMarks) || 0), 0);

  const questionsWithoutMarks = useMemo(
    () => questions.filter((q) => !(q.maxMarks > 0)),
    [questions]
  );

  const rowStats = useMemo(() => {
    const map = {};
    (sheet?.students || []).forEach((student) => {
      let total = 0;
      let entered = 0;
      questions.forEach((q) => {
        const raw = (draft[`${student.studentId}|${q.questionId}`] || "").trim();
        if (!raw) return;
        const value = Number(raw);
        if (Number.isNaN(value)) return;
        total += value;
        entered += 1;
      });
      map[student.studentId] = {
        total: entered > 0 ? total : null,
        percentage:
          entered > 0 && assessmentTotal > 0
            ? Math.round((total * 10000) / assessmentTotal) / 100
            : null,
      };
    });
    return map;
  }, [sheet, draft, questions, assessmentTotal]);

  const setMark = (studentId, questionId, text) => {
    setDraft((prev) => ({ ...prev, [`${studentId}|${questionId}`]: text.replace(/[^0-9.]/g, "") }));
  };

  const handleSave = async () => {
    if (!sheet) return;
    if (questionsWithoutMarks.length > 0) {
      showAlert("Question marks required", "Set max marks on each question before entering student scores.");
      return;
    }

    const marks = [];
    for (const student of sheet.students || []) {
      for (const question of questions) {
        const raw = (draft[`${student.studentId}|${question.questionId}`] || "").trim();
        if (!raw) {
          marks.push({ studentId: student.studentId, questionId: question.questionId, obtainedMarks: null });
          continue;
        }
        const value = Number(raw);
        if (Number.isNaN(value) || value < 0) {
          showAlert("Invalid marks", `Check marks for ${student.aridNo} / ${question.questionNo}.`);
          return;
        }
        if (value > question.maxMarks) {
          showAlert("Invalid marks", `${student.aridNo} / ${question.questionNo} cannot exceed ${question.maxMarks}.`);
          return;
        }
        marks.push({ studentId: student.studentId, questionId: question.questionId, obtainedMarks: value });
      }
    }

    try {
      setSaving(true);
      applySheet(await saveAssessmentMarksSheet(assessmentId, offeredCourseId, { teacherUserId, marks }));
      showAlert("Saved", "Student marks saved for this assessment.");
    } catch (error) {
      showAlert("Save failed", error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-full bg-page pb-12">
      <div className="border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8 dark:border-[#1b2c2e] dark:bg-[#071113]">
        <div className="flex min-w-0 items-center gap-3">
          <PageBackButton className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-gray-900 dark:text-white">Mark Sheet</h1>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {sheet
                ? [headerLabel, headerTitle, assessmentTotal > 0 ? `Total ${formatNumber(assessmentTotal)}` : ""]
                    .filter(Boolean)
                    .join(" · ")
                : "Student scores per question"}
            </p>
          </div>
        </div>
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        {loading || !sheet ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
          </div>
        ) : (
          <div className="space-y-3">
            {questionsWithoutMarks.length > 0 ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                Some questions have no max marks. Add max marks before scoring students.
              </p>
            ) : null}
            {(sheet.students || []).length === 0 ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                No students enrolled in this offered course.
              </p>
            ) : null}
            {questions.length === 0 ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                No gradeable questions on this assessment yet.
              </p>
            ) : null}

            <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
              <table className="min-w-full table-fixed text-xs">
                <thead className="bg-[#166534] text-white">
                  <tr>
                    <th className="w-56 px-4 py-3 text-left align-middle font-black">Student</th>
                    {questions.map((q) => (
                      <th key={q.questionId} className="px-2 py-3 text-center align-middle font-black">
                        <div>{q.questionNo}</div>
                        <div className="font-semibold opacity-80">/ {q.maxMarks || "?"}</div>
                      </th>
                    ))}
                    <th className="w-28 px-2 py-3 text-center align-middle font-black">Total</th>
                    <th className="w-28 px-2 py-3 text-center align-middle font-black">%</th>
                  </tr>
                </thead>
                <tbody>
                  {(sheet.students || []).map((student) => {
                    const stats = rowStats[student.studentId] || {};
                    return (
                      <tr key={student.studentId} className="border-t border-gray-100 dark:border-[#1b2c2e]">
                        <td className="px-4 py-2 text-left align-middle">
                          <div className="font-extrabold text-gray-900 dark:text-white">{student.fullName}</div>
                          <div className="text-gray-500">{student.aridNo}</div>
                        </td>
                        {questions.map((q) => (
                          <td key={`${student.studentId}|${q.questionId}`} className="px-2 py-2 text-center align-middle">
                            <input
                              className="mx-auto block w-16 rounded-lg border border-gray-200 bg-white px-1 py-1.5 text-center font-bold dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                              value={draft[`${student.studentId}|${q.questionId}`] ?? ""}
                              onChange={(e) => setMark(student.studentId, q.questionId, e.target.value)}
                              placeholder="-"
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2 text-center align-middle font-black text-emerald-800">
                          {formatNumber(stats.total)}
                        </td>
                        <td className="px-2 py-2 text-center align-middle font-black text-emerald-800">
                          {stats.percentage == null ? "—" : `${formatNumber(stats.percentage)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="flex-1 rounded-2xl bg-[#15803d] py-3 text-sm font-extrabold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Marks"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
