import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getComponentMarks, saveComponentMarks } from "../../api/courseResultsApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert } from "../../utils/dialogs";
import { getAuthUserId } from "../../utils/helpers";

function numOrEmpty(v) {
  if (v == null || v === "") return "";
  return String(v);
}

export default function TeacherComponentMarksScreen() {
  const { user } = useContext(AuthContext);
  const { offeredCourseId: ocParam } = useParams();
  const offeredCourseId = Number(ocParam);
  const [searchParams] = useSearchParams();
  const routeTeacher = searchParams.get("teacherUserId");
  const teacherUserId =
    routeTeacher != null && routeTeacher !== ""
      ? Number(routeTeacher) || getAuthUserId(user)
      : getAuthUserId(user);
  const courseTitleQs = searchParams.get("courseTitle") || "";

  const [sheet, setSheet] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!offeredCourseId || !teacherUserId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await getComponentMarks(offeredCourseId, teacherUserId);
      setSheet(data);
      const extraCols = data?.extraColumns ?? data?.ExtraColumns ?? [];
      const next = {};
      for (const s of data?.students ?? data?.Students ?? []) {
        const id = s.studentId ?? s.StudentId;
        const extraObtained = s.extraObtained ?? s.ExtraObtained ?? {};
        const row = {
          attendancePercent: numOrEmpty(s.attendancePercent ?? s.AttendancePercent),
          labTaskObtained: numOrEmpty(s.labTaskObtained ?? s.LabTaskObtained),
          projectObtained: numOrEmpty(s.projectObtained ?? s.ProjectObtained),
        };
        for (const col of extraCols) {
          const key = col.key ?? col.Key;
          row[`extra:${key}`] = numOrEmpty(extraObtained[key]);
        }
        next[id] = row;
      }
      setDraft(next);
    } catch (error) {
      showAlert("Component Marks", error.message);
      setSheet(null);
    } finally {
      setLoading(false);
    }
  }, [offeredCourseId, teacherUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const showAttendance = Boolean(sheet?.showAttendance ?? sheet?.ShowAttendance);
  const showLab = Boolean(sheet?.showLabTasks ?? sheet?.ShowLabTasks);
  const showProject = Boolean(sheet?.showProject ?? sheet?.ShowProject);
  const students = sheet?.students ?? sheet?.Students ?? [];

  const columns = useMemo(() => {
    const cols = [];
    if (showAttendance) {
      cols.push({
        key: "attendancePercent",
        label: `Attendance % (HW ${sheet?.homeworkAttendanceMax ?? sheet?.HomeworkAttendanceMax ?? 0} / Lab ${sheet?.labAttendanceMax ?? sheet?.LabAttendanceMax ?? 0})`,
        max: 100,
      });
    }
    if (showLab) {
      cols.push({
        key: "labTaskObtained",
        label: `Lab tasks (max ${sheet?.labTaskMax ?? sheet?.LabTaskMax ?? 0})`,
        max: Number(sheet?.labTaskMax ?? sheet?.LabTaskMax) || undefined,
      });
    }
    if (showProject) {
      cols.push({
        key: "projectObtained",
        label: `Project (max ${sheet?.projectMax ?? sheet?.ProjectMax ?? 0})`,
        max: Number(sheet?.projectMax ?? sheet?.ProjectMax) || undefined,
      });
    }
    for (const extra of sheet?.extraColumns ?? sheet?.ExtraColumns ?? []) {
      const extraKey = extra.key ?? extra.Key;
      cols.push({
        key: `extra:${extraKey}`,
        extraKey,
        label: extra.label ?? extra.Label,
        max: Number(extra.maxMarks ?? extra.MaxMarks) || undefined,
      });
    }
    return cols;
  }, [sheet, showAttendance, showLab, showProject]);

  const setCell = (studentId, key, value) => {
    setDraft((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [key]: value },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const extraCols = sheet?.extraColumns ?? sheet?.ExtraColumns ?? [];
      const entries = Object.entries(draft).map(([studentId, row]) => ({
        studentId: Number(studentId),
        attendancePercent:
          row.attendancePercent === "" || row.attendancePercent == null
            ? null
            : Number(row.attendancePercent),
        labTaskObtained:
          row.labTaskObtained === "" || row.labTaskObtained == null
            ? null
            : Number(row.labTaskObtained),
        projectObtained:
          row.projectObtained === "" || row.projectObtained == null
            ? null
            : Number(row.projectObtained),
        extraObtained: Object.fromEntries(
          extraCols.map((col) => {
            const extraKey = col.key ?? col.Key;
            const value = row[`extra:${extraKey}`];
            return [
              extraKey,
              value === "" || value == null ? null : Number(value),
            ];
          })
        ),
      }));
      const saved = await saveComponentMarks(offeredCourseId, {
        teacherUserId,
        entries,
      });
      setSheet(saved);
      showAlert("Saved", "Component marks saved successfully.");
      await load();
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  const title =
    sheet?.courseTitle ?? sheet?.CourseTitle ?? (courseTitleQs || "Component Marks");
  const section = sheet?.sectionName ?? sheet?.SectionName ?? "";

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-gray-900">Component Marks</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            {title}
            {section ? ` · ${section}` : ""}
          </p>
        </div>
        <button
          type="button"
          disabled={saving || loading || !columns.length}
          onClick={handleSave}
          className="app-btn-primary rounded-2xl px-4 py-2 text-sm disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="w-full px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
          </div>
        ) : !columns.length ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center shadow-card">
            <p className="text-sm font-medium text-gray-700">
              No component marks are required for this course yet.
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Configure homework/lab schemes (attendance, lab tasks, project, extra items) under Mappings first.
            </p>
          </div>
        ) : students.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">
            No enrolled students for this offered course.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-card">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-3 py-3">ARID</th>
                  <th className="px-3 py-3">Student</th>
                  {columns.map((col) => (
                    <th key={col.key} className="px-3 py-3">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((s) => {
                  const id = s.studentId ?? s.StudentId;
                  const row = draft[id] || {};
                  return (
                    <tr key={id}>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">
                        {s.aridNo ?? s.AridNo}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {s.fullName ?? s.FullName}
                      </td>
                      {columns.map((col) => (
                        <td key={col.key} className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            max={col.max}
                            step="0.01"
                            placeholder="0"
                            className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm placeholder:text-gray-400"
                            value={row[col.key] ?? ""}
                            onChange={(e) => setCell(id, col.key, e.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
