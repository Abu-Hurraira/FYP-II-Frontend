import React, { useCallback, useContext, useEffect, useState } from "react";
import { getHodUploadAllocation, saveHodUploadAllocation } from "../../api/hodUploadAllocationApi";
import { getOfferedCourses } from "../../api/offeredCoursesApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import { UPLOAD_ALLOCATION_TYPES, EMPTY_UPLOAD_ALLOCATION_ROW } from "../../constants/uploadAllocationTypes";
import theme from "../../styles/theme";
import { showAlert } from "../../utils/dialogs";
import {
  buildAllocationsForSave,
  normalizeAllocationRow,
  rowHasAnyPermission,
} from "../../utils/hodUploadAllocationStorage";

function normalizeOfferedCourse(raw) {
  return {
    offeredCourseId: raw.offeredCourseId ?? raw.OfferedCourseId,
    courseId: raw.courseId ?? raw.CourseId,
    sectionId: raw.sectionId ?? raw.SectionId,
    teacherUserId: raw.teacherUserId ?? raw.TeacherUserId,
    courseTitle: raw.courseTitle ?? raw.CourseTitle ?? "",
    courseCode: raw.courseCode ?? raw.CourseCode ?? "",
    sectionName: raw.sectionName ?? raw.SectionName ?? "",
    teacherName: raw.teacherName ?? raw.TeacherName ?? "",
    programName: raw.programName ?? raw.ProgramName ?? "",
  };
}

function sortOfferedCourses(rows) {
  return [...rows].sort((a, b) => {
    const courseCmp = String(a.courseTitle).localeCompare(String(b.courseTitle));
    if (courseCmp !== 0) return courseCmp;
    return String(a.sectionName).localeCompare(String(b.sectionName), undefined, { numeric: true });
  });
}

function buildRowsFromConfig(offeredCourses, config) {
  const saved = config?.allocations ?? {};
  const rows = {};

  for (const course of offeredCourses) {
    const key = String(course.offeredCourseId);
    rows[key] = normalizeAllocationRow(saved[key]);
  }

  return rows;
}

export default function HodAllocationScreen() {
  const { user } = useContext(AuthContext);
  const [offeredCourses, setOfferedCourses] = useState([]);
  const [rows, setRows] = useState({});
  const [savedRows, setSavedRows] = useState({});
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [coursesRaw, config] = await Promise.all([
        getOfferedCourses(),
        getHodUploadAllocation(),
      ]);
      const courses = sortOfferedCourses(
        (Array.isArray(coursesRaw) ? coursesRaw : []).map(normalizeOfferedCourse)
      );
      const loadedRows = buildRowsFromConfig(courses, config);
      setOfferedCourses(courses);
      setConfigured(Boolean(config?.configured));
      setRows(loadedRows);
      setSavedRows(loadedRows);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const togglePermission = (offeredCourseId, permissionKey) => {
    const key = String(offeredCourseId);
    setRows((prev) => {
      const current = normalizeAllocationRow(prev[key]);
      return {
        ...prev,
        [key]: {
          ...current,
          [permissionKey]: !current[permissionKey],
        },
      };
    });
  };

  const isSavedChecked = (offeredCourseId, permissionKey) => {
    if (!configured) return false;
    const saved = normalizeAllocationRow(savedRows[String(offeredCourseId)]);
    return Boolean(saved[permissionKey]);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const allocations = buildAllocationsForSave(offeredCourses, rows);
      const hadManualEdits = Object.values(rows).some((row) => rowHasAnyPermission(row));

      const saved = await saveHodUploadAllocation({
        configured: true,
        allocations,
      });

      const nextRows = buildRowsFromConfig(offeredCourses, saved);
      setConfigured(true);
      setRows(nextRows);
      setSavedRows(nextRows);

      showAlert(
        "Saved",
        hadManualEdits
          ? "Allocation saved. Unselected courses use Section A by default; single-section courses are fully allocated."
          : "Section A teacher (or the only section) for each course was allocated all upload types."
      );
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-page">
      <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Allocation</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {user?.fullName || user?.name || "HOD"} · Assign upload responsibilities
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Tick CLOs, Mid, Final, or Folder Template per teacher. Other courses auto-allocate Section A on
              save. Single-section courses are always fully allocated.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="app-btn-primary rounded-2xl px-5 py-2.5 text-sm disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Allocation"}
          </button>
        </div>
        {configured ? (
          <p className="mt-2 text-xs font-semibold text-blue-700">
            Saved allocations show blue ticks. Allocation is active for teachers.
          </p>
        ) : (
          <p className="mt-2 text-xs text-amber-700">
            Not saved yet — teachers currently have full upload access until you save.
          </p>
        )}
      </div>

      <div className="w-full px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : offeredCourses.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">
            No offered courses found. Add courses in a session first.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-card">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-3 py-3">Course</th>
                  <th className="px-3 py-3">Section</th>
                  <th className="px-3 py-3">Teacher</th>
                  {UPLOAD_ALLOCATION_TYPES.map((type) => (
                    <th key={type.key} className="px-3 py-3 text-center">
                      {type.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {offeredCourses.map((course) => {
                  const key = String(course.offeredCourseId);
                  const row = normalizeAllocationRow(rows[key] ?? EMPTY_UPLOAD_ALLOCATION_ROW);

                  return (
                    <tr key={course.offeredCourseId} className="hover:bg-brand-muted/40/80">
                      <td className="px-3 py-3 align-middle">
                        <p className="font-semibold text-gray-900">{course.courseTitle}</p>
                        {course.courseCode ? (
                          <p className="text-xs text-gray-500">{course.courseCode}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 align-middle text-gray-700">{course.sectionName || "—"}</td>
                      <td className="px-3 py-3 align-middle text-gray-700">{course.teacherName || "—"}</td>
                      {UPLOAD_ALLOCATION_TYPES.map((type) => {
                        const checked = row[type.key];
                        const saved = isSavedChecked(course.offeredCourseId, type.key);
                        return (
                          <td key={type.key} className="px-3 py-3 text-center align-middle">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePermission(course.offeredCourseId, type.key)}
                              className={`h-4 w-4 cursor-pointer rounded border-gray-300 focus:ring-blue-500 ${
                                saved && checked
                                  ? "accent-blue-600 ring-2 ring-blue-300"
                                  : "accent-brand"
                              }`}
                              aria-label={`${type.label} for ${course.teacherName}`}
                            />
                          </td>
                        );
                      })}
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
