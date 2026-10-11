import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { getProgramPloMatrix, saveProgramPloMatrix } from "../../api/ploCourseMappingApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import theme from "../../styles/theme";
import { showAlert } from "../../utils/dialogs";
import PercentInput from "../../components/PercentInput.jsx";
import { getAuthUserId } from "../../utils/helpers";
import { ploDisplayLabel, sortPlos } from "../../utils/outcomeHelpers";

function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj?.[key] != null) return obj[key];
  }
  return undefined;
}

function getCourseRow(matrix, programCourseId, plos) {
  const key = String(programCourseId);
  const existing = matrix[key];
  if (existing) return existing;
  const row = {};
  for (const plo of plos) {
    row[String(plo.ploId)] = { mapped: false, weight: 0 };
  }
  return row;
}

function columnTotals(matrix, programCourseIds, plos) {
  const totals = {};
  for (const plo of plos) {
    const ploKey = String(plo.ploId);
    let sum = 0;
    for (const pcId of programCourseIds) {
      const cell = matrix[String(pcId)]?.[ploKey];
      if (cell?.mapped) sum += Number(cell.weight) || 0;
    }
    totals[ploKey] = Math.round(sum * 100) / 100;
  }
  return totals;
}

function MappingInfoBlocks({ course, plo, ploIndex, compact = false }) {
  const blockClass = compact
    ? "rounded-md border border-gray-200 bg-gray-50 p-2"
    : "rounded-lg border border-gray-200 bg-gray-50 p-3";

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      <div className={blockClass}>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Course</p>
        <p className={`mt-1 font-semibold text-gray-900 ${compact ? "text-sm" : ""}`}>
          {course.courseTitle}
        </p>
        {course.courseCode ? (
          <p className={`text-gray-600 ${compact ? "text-xs" : "text-sm"}`}>{course.courseCode}</p>
        ) : null}
      </div>
      <div className={blockClass}>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">PLO</p>
        <p className={`mt-1 font-semibold text-gray-900 ${compact ? "text-sm" : ""}`}>
          {ploDisplayLabel(plo, ploIndex)}
        </p>
        {plo.ploDescription ? (
          <p className={`mt-1 text-gray-600 ${compact ? "text-xs" : "text-sm"}`}>
            {plo.ploDescription}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function HodPloCourseMappingScreen() {
  const { user } = useContext(AuthContext);
  const { programId } = useParams();
  const location = useLocation();
  const program = location.state?.program;
  const targetProgramId = Number(programId || program?.programId);
  const valid = Boolean(targetProgramId && !Number.isNaN(targetProgramId));

  const [courses, setCourses] = useState([]);
  const [plos, setPlos] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [programName, setProgramName] = useState(program?.programName || "");
  const [mappingModal, setMappingModal] = useState(null);
  const [modalWeight, setModalWeight] = useState("");
  const [hoverTip, setHoverTip] = useState(null);

  const sortedPlos = useMemo(() => sortPlos(plos), [plos]);

  useEffect(() => {
    if (!valid) {
      setLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await getProgramPloMatrix(targetProgramId);
        if (!mounted) return;

        const apiPlos = (pick(data, "plos", "Plos") || []).map((p) => ({
          ploId: pick(p, "ploId", "PloId"),
          ploCode: pick(p, "ploCode", "PloCode") || "",
          ploDescription: pick(p, "ploDescription", "PloDescription") || "",
        }));
        const orderedPlos = sortPlos(apiPlos);
        setPlos(orderedPlos);
        setProgramName(pick(data, "programName", "ProgramName") || program?.programName || "");

        const apiCoursesRaw = pick(data, "courses", "Courses") || [];
        const apiCourses = apiCoursesRaw.map((c) => ({
          programCourseId: pick(c, "programCourseId", "ProgramCourseId"),
          courseId: pick(c, "courseId", "CourseId"),
          courseTitle: pick(c, "courseTitle", "CourseTitle") || "",
          courseCode: pick(c, "courseCode", "CourseCode") || "",
        }));
        setCourses(apiCourses);

        const nextMatrix = {};
        for (const c of apiCourses) {
          const row = {};
          for (const plo of orderedPlos) {
            row[String(plo.ploId)] = { mapped: false, weight: 0 };
          }
          const apiRow = apiCoursesRaw.find(
            (r) =>
              Number(pick(r, "programCourseId", "ProgramCourseId")) === Number(c.programCourseId)
          );
          for (const cell of pick(apiRow, "cells", "Cells") || []) {
            const ploId = String(pick(cell, "ploId", "PloId"));
            const pct = pick(cell, "percentage", "Percentage");
            if (pct != null && Number(pct) > 0) {
              row[ploId] = { mapped: true, weight: Number(pct) };
            }
          }
          nextMatrix[String(c.programCourseId)] = row;
        }
        setMatrix(nextMatrix);
      } catch (error) {
        if (mounted) showAlert("Error", error.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [valid, targetProgramId]);

  const programCourseIds = useMemo(
    () => courses.map((c) => String(c.programCourseId)),
    [courses]
  );
  const colTotals = useMemo(
    () => columnTotals(matrix, programCourseIds, sortedPlos),
    [matrix, programCourseIds, sortedPlos]
  );

  const updateCell = (programCourseId, ploId, patch) => {
    setMatrix((prev) => {
      const next = { ...prev };
      const row = { ...getCourseRow(next, programCourseId, sortedPlos) };
      const key = String(ploId);
      const cell = { ...row[key], ...patch };
      if (patch.mapped === false) cell.weight = 0;
      row[key] = cell;
      next[String(programCourseId)] = row;
      return next;
    });
  };

  const remainingForPlo = (ploId, excludeProgramCourseId = null) => {
    const ploKey = String(ploId);
    let used = 0;
    for (const pcId of programCourseIds) {
      if (excludeProgramCourseId != null && String(pcId) === String(excludeProgramCourseId)) {
        continue;
      }
      const cell = matrix[pcId]?.[ploKey];
      if (cell?.mapped) used += Number(cell.weight) || 0;
    }
    return Math.max(0, Math.round((100 - used) * 100) / 100);
  };

  const openMappingModal = (course, plo, ploIndex, currentWeight = 0) => {
    const remaining = remainingForPlo(plo.ploId, course.programCourseId);
    if (remaining <= 0 && !(currentWeight > 0)) {
      showAlert(
        "Limit reached",
        `${ploDisplayLabel(plo, ploIndex)} already totals 100% across other courses.`
      );
      return;
    }
    setHoverTip(null);
    setMappingModal({ course, plo, ploIndex, remaining });
    setModalWeight(currentWeight > 0 ? String(Math.min(currentWeight, remaining)) : "");
  };

  const closeMappingModal = () => {
    setMappingModal(null);
    setModalWeight("");
  };

  const handleModalSave = () => {
    if (!mappingModal) return;
    const remaining = remainingForPlo(mappingModal.plo.ploId, mappingModal.course.programCourseId);
    const weight = Math.min(100, Math.max(0, Number(modalWeight) || 0));
    if (weight <= 0) {
      showAlert("Validation", "Enter a percentage greater than 0.");
      return;
    }
    if (weight > remaining) {
      showAlert("Validation", `Only ${remaining}% remaining for this PLO column.`);
      return;
    }
    updateCell(mappingModal.course.programCourseId, mappingModal.plo.ploId, {
      mapped: true,
      weight,
    });
    closeMappingModal();
  };

  const mappedCount = useMemo(() => {
    let count = 0;
    for (const row of Object.values(matrix || {})) {
      for (const cell of Object.values(row || {})) {
        if (cell?.mapped) count += 1;
      }
    }
    return count;
  }, [matrix]);

  const handleSave = async () => {
    if (!valid) return;
    const hodUserId = getAuthUserId(user);
    if (!hodUserId) {
      showAlert("Error", "HOD user not found. Please sign in again.");
      return;
    }
    if (mappedCount === 0) {
      showAlert("Nothing to save", "Select at least one course–PLO mapping before saving.");
      return;
    }

    const totals = columnTotals(matrix, programCourseIds, sortedPlos);
    const invalidColumns = sortedPlos
      .map((plo, index) => ({
        label: ploDisplayLabel(plo, index),
        total: totals[String(plo.ploId)] || 0,
      }))
      .filter(({ total }) => total > 0 && total !== 100);

    if (invalidColumns.length > 0) {
      showAlert(
        "Validation",
        `Each used PLO column must total 100%. Check: ${invalidColumns
          .map(({ label, total }) => `${label} (${total}%)`)
          .join(", ")}`
      );
      return;
    }

    try {
      setSaving(true);
      const cells = [];
      for (const course of courses) {
        const row = matrix[String(course.programCourseId)] || {};
        for (const plo of sortedPlos) {
          const cell = row[String(plo.ploId)];
          if (cell?.mapped && Number(cell.weight) > 0) {
            cells.push({
              programCourseId: Number(course.programCourseId),
              ploId: Number(plo.ploId),
              percentage: Number(cell.weight),
            });
          }
        }
      }
      await saveProgramPloMatrix(targetProgramId, {
        mappedByUserId: hodUserId,
        cells,
      });
      showAlert(
        "Saved",
        `PLO–Course mapping saved to database (${mappedCount} mapping${mappedCount === 1 ? "" : "s"}).`
      );
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!valid) {
    return (
      <div className="min-h-full bg-page">
        <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
          <PageBackButton className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-gray-900">PLOs, Course Mapping</h1>
            <p className="mt-0.5 text-xs text-gray-500">Program data missing.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-gray-900">PLOs, Course Mapping</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            {programName || `Program #${targetProgramId}`} · {user?.roleName || "HOD"}
          </p>
        </div>
        <button
          type="button"
          disabled={saving || loading || sortedPlos.length === 0}
          onClick={handleSave}
          className="app-btn-primary shrink-0 rounded-2xl px-4 py-2 text-sm shadow-sm disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        <p className="mb-3 text-xs text-gray-500">
          Courses linked to this program are shown. Each used PLO column must total <strong>100%</strong>.
        </p>

        {loading ? (
          <div className="flex justify-center py-16">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : sortedPlos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center shadow-sm">
            <p className="text-sm font-semibold text-gray-800">No PLOs added yet</p>
            <p className="mt-2 text-sm text-gray-500">Add PLOs under Program → PLOs first.</p>
          </div>
        ) : courses.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">
            No program courses found. Link courses under Program → Courses first.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-card">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-amber-50">
                  <th className="sticky left-0 z-20 min-w-[180px] border-r border-gray-200 bg-amber-50 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-600">
                    Total %
                  </th>
                  {sortedPlos.map((plo) => {
                    const total = colTotals[String(plo.ploId)] || 0;
                    return (
                      <th
                        key={`total-${plo.ploId}`}
                        className={`min-w-[72px] px-2 py-2 text-center text-xs font-bold ${
                          total === 100
                            ? "text-emerald-700"
                            : total > 100
                              ? "text-red-600"
                              : "text-gray-700"
                        }`}
                      >
                        {total}%
                      </th>
                    );
                  })}
                </tr>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="sticky left-0 z-20 min-w-[180px] border-r border-gray-200 bg-gray-50 px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-600">
                    Course
                  </th>
                  {sortedPlos.map((plo, index) => (
                    <th
                      key={plo.ploId}
                      className="min-w-[72px] max-w-[120px] px-2 py-3 text-center text-xs font-semibold text-gray-700"
                      title={plo.ploDescription || ""}
                    >
                      {ploDisplayLabel(plo, index)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => {
                  const pcKey = String(course.programCourseId);
                  const row = getCourseRow(matrix, pcKey, sortedPlos);
                  return (
                    <tr key={pcKey} className="border-b border-gray-100 hover:bg-brand-muted/40">
                      <td className="sticky left-0 z-10 border-r border-gray-200 bg-white px-3 py-3">
                        <p className="font-semibold text-gray-900">{course.courseTitle}</p>
                        {course.courseCode ? (
                          <p className="text-xs text-gray-500">{course.courseCode}</p>
                        ) : null}
                      </td>
                      {sortedPlos.map((plo, ploIndex) => {
                        const cell = row[String(plo.ploId)] || { mapped: false, weight: 0 };
                        return (
                          <td key={plo.ploId} className="px-1 py-2 text-center align-middle">
                            <div className="flex flex-col items-center gap-1">
                              <input
                                type="checkbox"
                                checked={Boolean(cell.mapped)}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoverTip({
                                    course,
                                    plo,
                                    ploIndex,
                                    top: rect.top,
                                    left: rect.left + rect.width / 2,
                                  });
                                }}
                                onMouseLeave={() => setHoverTip(null)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    openMappingModal(course, plo, ploIndex, cell.weight);
                                  } else {
                                    updateCell(pcKey, plo.ploId, { mapped: false, weight: 0 });
                                  }
                                }}
                                className="h-4 w-4 rounded border-gray-300"
                                aria-label={`Map ${course.courseTitle} to ${ploDisplayLabel(plo, ploIndex)}`}
                              />
                              {cell.mapped ? (
                                <button
                                  type="button"
                                  onClick={() => openMappingModal(course, plo, ploIndex, cell.weight)}
                                  className="text-xs font-semibold text-brand hover:underline"
                                >
                                  {cell.weight}%
                                </button>
                              ) : null}
                            </div>
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

      {hoverTip && !mappingModal && (
        <div
          className="pointer-events-none fixed z-40 w-72 -translate-x-1/2 -translate-y-full rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
          style={{ top: hoverTip.top - 8, left: hoverTip.left }}
          role="tooltip"
        >
          <MappingInfoBlocks
            course={hoverTip.course}
            plo={hoverTip.plo}
            ploIndex={hoverTip.ploIndex}
            compact
          />
        </div>
      )}

      {mappingModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6"
          onClick={closeMappingModal}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Map Course to PLO</h2>
            <div className="mb-4">
              <MappingInfoBlocks
                course={mappingModal.course}
                plo={mappingModal.plo}
                ploIndex={mappingModal.ploIndex}
              />
            </div>
            <label className="block text-sm font-semibold text-gray-700">
              Contribution %
              <PercentInput
                min={0}
                max={mappingModal.remaining ?? 100}
                value={modalWeight}
                onChange={(next) => setModalWeight(next === "" ? "" : String(next))}
                className="mt-2 w-full rounded-2xl border border-gray-100 bg-white shadow-card px-3 py-2 text-sm"
              />
            </label>
            <p className="mt-2 text-xs text-gray-500">
              Remaining for {ploDisplayLabel(mappingModal.plo, mappingModal.ploIndex)}:{" "}
              <strong>{mappingModal.remaining ?? 100}%</strong>
            </p>
            <button
              type="button"
              onClick={handleModalSave}
              className="mt-4 w-full rounded-lg py-3 font-black text-white"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              Save
            </button>
            <button type="button" onClick={closeMappingModal} className="mt-3 w-full font-bold text-gray-500">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
