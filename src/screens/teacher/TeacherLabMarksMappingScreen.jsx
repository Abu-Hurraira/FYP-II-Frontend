import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getLabMarkScheme, saveLabMarkScheme } from "../../api/courseResultsApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import ExtraMappingFields, {
  capMarksInput,
  extrasFromScheme,
  parseMark,
} from "../../components/ExtraMappingFields.jsx";
import { showAlert } from "../../utils/dialogs";

const COLUMNS = [
  { key: "quizMarks", label: "Quiz" },
  { key: "assignmentMarks", label: "Assignment" },
  { key: "labTaskMarks", label: "Lab Tasks" },
  { key: "projectMarks", label: "Project" },
  { key: "attendanceMarks", label: "Attendance" },
  { key: "examMarks", label: "Exam" },
];

function str(data, camel, pascal) {
  const v = data?.[camel] ?? data?.[pascal];
  return v == null || v === "" ? "" : String(v);
}

export default function TeacherLabMarksMappingScreen({ embedded = false }) {
  const { user } = useContext(AuthContext);
  const { offeredCourseId: ocParam } = useParams();
  const offeredCourseId = Number(ocParam);
  const [searchParams] = useSearchParams();
  const routeTeacher = searchParams.get("teacherUserId");
  const teacherUserId =
    routeTeacher != null && routeTeacher !== ""
      ? Number(routeTeacher) || user?.userId
      : user?.userId;
  const courseTitle = searchParams.get("courseTitle") || "";
  const [scheme, setScheme] = useState(null);
  const [values, setValues] = useState({
    quizMarks: "",
    assignmentMarks: "",
    labTaskMarks: "",
    projectMarks: "",
    attendanceMarks: "",
    examMarks: "",
  });
  const [extras, setExtras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLabMarkScheme(offeredCourseId, teacherUserId);
      setScheme(data);
      setValues({
        quizMarks: str(data, "quizMarks", "QuizMarks"),
        assignmentMarks: str(data, "assignmentMarks", "AssignmentMarks"),
        labTaskMarks: str(data, "labTaskMarks", "LabTaskMarks"),
        projectMarks: str(data, "projectMarks", "ProjectMarks"),
        attendanceMarks: str(data, "attendanceMarks", "AttendanceMarks"),
        examMarks: str(data, "examMarks", "ExamMarks"),
      });
      setExtras(extrasFromScheme(data));
    } catch (error) {
      showAlert("Lab Marks", error.message);
    } finally {
      setLoading(false);
    }
  }, [offeredCourseId, teacherUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const target = Number(scheme?.targetMarks ?? scheme?.TargetMarks) || 20;
  const assigned = useMemo(
    () =>
      COLUMNS.reduce((sum, col) => sum + parseMark(values[col.key]), 0) +
      extras.reduce((sum, item) => sum + parseMark(item.marks), 0),
    [values, extras]
  );
  const remaining = Math.round((target - assigned) * 100) / 100;

  const warnLimit = () => {
    showAlert("Marks limit", `You cannot enter extra marks above ${target}.`);
  };

  const setCappedValue = (key, raw) => {
    const others = assigned - parseMark(values[key]);
    const next = capMarksInput(raw, others, target, warnLimit);
    setValues((prev) => ({ ...prev, [key]: next }));
  };

  const handleSave = async () => {
    if (remaining < 0) {
      showAlert("Marks limit", `You cannot enter extra marks above ${target}.`);
      return;
    }
    try {
      setSaving(true);
      const saved = await saveLabMarkScheme(offeredCourseId, {
        teacherUserId,
        quizMarks: parseMark(values.quizMarks),
        assignmentMarks: parseMark(values.assignmentMarks),
        labTaskMarks: parseMark(values.labTaskMarks),
        projectMarks: parseMark(values.projectMarks),
        attendanceMarks: parseMark(values.attendanceMarks),
        examMarks: parseMark(values.examMarks),
        extraItems: extras
          .filter((item) => item.name.trim())
          .map((item) => ({
            key: item.key,
            name: item.name.trim(),
            marks: parseMark(item.marks),
          })),
      });
      setScheme(saved);
      setExtras(extrasFromScheme(saved));
      showAlert("Saved", saved.isComplete || saved.IsComplete
        ? "Lab marks mapping is complete."
        : `Saved. Remaining: ${saved.remainingMarks ?? saved.RemainingMarks} of ${saved.targetMarks ?? saved.TargetMarks}.`);
    } catch (error) {
      showAlert("Save failed", error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={embedded ? "pb-4" : "relative min-h-full bg-page pb-12"}>
      {embedded ? null : (
        <div className="border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8 dark:border-[#1b2c2e] dark:bg-[#071113]">
          <div className="flex min-w-0 items-center gap-3">
            <PageBackButton className="mt-0.5 shrink-0" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Lab Marks Mapping</h1>
              <p className="mt-0.5 text-xs text-gray-500">{courseTitle}</p>
            </div>
          </div>
        </div>
      )}
      <div className={embedded ? "mx-auto max-w-xl space-y-4" : "mx-auto max-w-xl space-y-4 px-4 pt-4"}>
        {loading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
            <h2 className="text-lg font-black">Divide {target} lab marks</h2>
            <p className="mt-1 text-xs font-medium text-gray-500">
              All items including extras must total {target}. Marks above {target} are not allowed.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {COLUMNS.map((col) => (
                <label key={col.key} className="block text-xs font-extrabold text-gray-700">
                  {col.label}
                  <input
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold placeholder:text-gray-400"
                    placeholder="e.g. 5"
                    value={values[col.key]}
                    onChange={(e) => setCappedValue(col.key, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <ExtraMappingFields extras={extras} onChange={setExtras} target={target} assigned={assigned} />
            <p className={`mt-3 text-sm font-extrabold ${remaining === 0 ? "text-emerald-700" : "text-amber-700"}`}>
              Assigned {assigned} · Remaining {remaining}
            </p>
            <button type="button" disabled={saving} onClick={handleSave} className="mt-4 w-full rounded-2xl bg-[#15803d] py-3 text-sm font-extrabold text-white disabled:opacity-50">
              {saving ? "Saving…" : "Save mapping"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
