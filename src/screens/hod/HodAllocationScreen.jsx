import React, { useCallback, useContext, useEffect, useState } from "react";
import { getHodUploadAllocation, saveHodUploadAllocation } from "../../api/hodUploadAllocationApi";
import { getOfferedCourses } from "../../api/offeredCoursesApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import { useHodProgram } from "../../context/HodProgramContext.jsx";
import { UPLOAD_ALLOCATION_TYPES, EMPTY_UPLOAD_ALLOCATION_ROW } from "../../constants/uploadAllocationTypes";
import theme from "../../styles/theme";
import HodMintHeader from "../../components/HodMintHeader.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";
import {
  buildSectionAAllocations,
  countVisibleTicks,
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
    programId: raw.programId ?? raw.ProgramId ?? null,
    programName: raw.programName ?? raw.ProgramName ?? "",
    programCode: raw.programCode ?? raw.ProgramCode ?? "",
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
  const { selectedProgramId, selectedProgram } = useHodProgram();
  const [offeredCourses, setOfferedCourses] = useState([]);
  const [rows, setRows] = useState({});
  const [savedRows, setSavedRows] = useState({});
  const [otherProgramAllocations, setOtherProgramAllocations] = useState({});
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (!selectedProgramId) {
        setOfferedCourses([]);
        setRows({});
        setSavedRows({});
        setOtherProgramAllocations({});
        setConfigured(false);
        return;
      }
      const [coursesRaw, apiConfig] = await Promise.all([
        getOfferedCourses(),
        getHodUploadAllocation().catch(() => ({ configured: false, allocations: {} })),
      ]);
      const allCourses = (Array.isArray(coursesRaw) ? coursesRaw : []).map(normalizeOfferedCourse);
      const courses = sortOfferedCourses(
        allCourses.filter((c) => Number(c.programId) === Number(selectedProgramId))
      );
      const programIds = new Set(courses.map((c) => String(c.offeredCourseId)));
      const config = apiConfig?.allocations
        ? apiConfig
        : { configured: false, allocations: {} };
      const other = {};
      for (const [id, row] of Object.entries(config.allocations || {})) {
        if (!programIds.has(String(id))) other[id] = normalizeAllocationRow(row);
      }
      const loadedRows = buildRowsFromConfig(courses, config);
      setOfferedCourses(courses);
      setOtherProgramAllocations(other);
      setConfigured(Boolean(config?.configured) || countVisibleTicks(courses, config.allocations) > 0);
      setRows(loadedRows);
      setSavedRows(loadedRows);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedProgramId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const togglePermission = (offeredCourseId, permissionKey) => {
    const key = String(offeredCourseId);
    setRows((prev) => {
      const current = normalizeAllocationRow(prev[key]);
      const nextVal = !current[permissionKey];
      const updated = {
        ...current,
        [permissionKey]: nextVal,
      };

      // When CLOs is ticked, automatically check CLO-PLO Map and Task-CLO Map as well
      if (permissionKey === "clos" && nextVal) {
        updated.cloPloMapping = true;
        updated.cloTaskMapping = true;
      }
      return {
        ...prev,
        [key]: updated,
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
      const hasManual = offeredCourses.some((course) =>
        rowHasAnyPermission(rows[String(course.offeredCourseId)])
      );
      const programAllocations = hasManual
        ? Object.fromEntries(
            offeredCourses
              .map((course) => {
                const id = String(course.offeredCourseId);
                return [id, normalizeAllocationRow(rows[id])];
              })
              .filter(([id]) => id && id !== "undefined")
          )
        : buildSectionAAllocations(offeredCourses);
      // Keep other programs' allocations so save does not wipe them.
      const allocations = { ...otherProgramAllocations, ...programAllocations };
      const allocatedCount = countVisibleTicks(offeredCourses, programAllocations);
      const nextRows = buildRowsFromConfig(offeredCourses, {
        configured: allocatedCount > 0,
        allocations: programAllocations,
      });
      setConfigured(allocatedCount > 0);
      setRows(nextRows);
      setSavedRows(nextRows);

      await saveHodUploadAllocation({
        configured:
          allocatedCount > 0 ||
          Object.values(otherProgramAllocations).some(rowHasAnyPermission),
        allocations,
      }, user?.userId ?? user?.UserId);

      showAlert(
        "Saved",
        hasManual
          ? `Allocation saved for ${allocatedCount} section${allocatedCount === 1 ? "" : "s"} in this program.`
          : `The first A section of each course was allocated (${allocatedCount} section${allocatedCount === 1 ? "" : "s"}).`
      );
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAll = async () => {
    if (
      !(await showConfirm(
        "Remove allocation",
        selectedProgram
          ? `Remove allocation from all courses in ${selectedProgram.programCode || selectedProgram.programName}? Other programs stay unchanged.`
          : "Remove allocation from every course in this program?"
      ))
    ) {
      return;
    }

    try {
      setRemoving(true);
      const allocations = { ...otherProgramAllocations };
      const hasOther = Object.values(allocations).some(rowHasAnyPermission);
      await saveHodUploadAllocation(
        { configured: hasOther, allocations },
        user?.userId ?? user?.UserId
      );
      const nextRows = buildRowsFromConfig(offeredCourses, {
        configured: false,
        allocations: {},
      });
      setConfigured(false);
      setRows(nextRows);
      setSavedRows(nextRows);
      showAlert("Removed", "Allocation removed for this program.");
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="min-h-full bg-page">
      <HodMintHeader
        title="Allocation"
        subtitle={
          selectedProgram
            ? `Assign upload responsibilities for ${selectedProgram.programCode || selectedProgram.programName}.`
            : "Select a program from the top bar to assign upload responsibilities."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRemoveAll}
              disabled={saving || removing || loading || offeredCourses.length === 0}
              className="rounded-2xl border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              {removing ? "Removing…" : "Remove Allocation"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || removing || loading}
              className="app-btn-primary rounded-2xl px-5 py-2.5 text-sm disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Allocation"}
            </button>
          </div>
        }
      />
      {configured ? (
        <p className="bg-white px-4 pb-3 text-xs font-semibold text-blue-700 sm:px-6 lg:px-8">
          Saved allocations show blue ticks. Allocation is active for teachers.
        </p>
      ) : (
        <p className="bg-white px-4 pb-3 text-xs text-amber-700 sm:px-6 lg:px-8">
          Nothing allocated yet. Click Save to auto-assign the first A section of each course, or tick rows yourself.
        </p>
      )}

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
