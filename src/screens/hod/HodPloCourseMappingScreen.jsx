import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { getCourses } from "../../api/coursesApi";
import { getPLOsByProgram } from "../../api/plosApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import theme from "../../styles/theme";
import { showAlert } from "../../utils/dialogs";
import {
  columnTotals,
  getCourseRow,
  loadPloCourseMapping,
  ploDisplayLabel,
  savePloCourseMapping,
  sortPlos,
} from "../../utils/ploCourseMappingStorage";

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

  const [courses, setCourses] = useState([]);
  const [plos, setPlos] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mappingModal, setMappingModal] = useState(null);
  const [modalWeight, setModalWeight] = useState("");
  const [hoverTip, setHoverTip] = useState(null);

  const valid = program && String(program.programId) === String(programId);
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
        const [courseData, ploData] = await Promise.all([
          getCourses(),
          getPLOsByProgram(program.programId),
        ]);
        if (!mounted) return;
        const programPlos = ploData || [];
        setCourses(courseData || []);
        const orderedPlos = sortPlos(programPlos);
        setPlos(orderedPlos);
        setMatrix(loadPloCourseMapping(program.programId, orderedPlos));
      } catch (error) {
        if (mounted) showAlert("Error", error.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [valid, program?.programId]);

  const courseIds = useMemo(() => courses.map((c) => String(c.courseId)), [courses]);
  const colTotals = useMemo(
    () => columnTotals(matrix, courseIds, sortedPlos),
    [matrix, courseIds, sortedPlos]
  );

  const updateCell = (courseId, ploId, patch) => {
    setMatrix((prev) => {
      const next = { ...prev };
      const row = { ...getCourseRow(next, courseId, sortedPlos) };
      const key = String(ploId);
      const cell = { ...row[key], ...patch };
      if (patch.mapped === false) {
        cell.weight = 0;
      }
      row[key] = cell;
      next[courseId] = row;
      return next;
    });
  };

  /** How much % is still free in this PLO column (other courses), optionally excluding one course being edited. */
  const remainingForPlo = (ploId, excludeCourseId = null) => {
    const ploKey = String(ploId);
    let used = 0;
    for (const courseId of courseIds) {
      if (excludeCourseId != null && String(courseId) === String(excludeCourseId)) continue;
      const cell = matrix[courseId]?.[ploKey];
      if (cell?.mapped) used += Number(cell.weight) || 0;
    }
    return Math.max(0, Math.round((100 - used) * 100) / 100);
  };

  const openMappingModal = (course, plo, ploIndex, currentWeight = 0) => {
    const remaining = remainingForPlo(plo.ploId, course.courseId);
    if (remaining <= 0 && !(currentWeight > 0)) {
      showAlert(
        "Limit reached",
        `${ploDisplayLabel(plo, ploIndex)} already totals 100% across other courses. Reduce another course's % first.`
      );
      return;
    }
    if (remaining <= 0 && currentWeight > 0) {
      showAlert(
        "Column over 100%",
        `${ploDisplayLabel(plo, ploIndex)} already uses 100% in other courses. Uncheck this mapping or lower another course's % before assigning a new value.`
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

    const remaining = remainingForPlo(mappingModal.plo.ploId, mappingModal.course.courseId);
    const weight = Math.min(100, Math.max(0, Number(modalWeight) || 0));

    if (weight <= 0) {
      showAlert("Validation", "Enter a percentage greater than 0.");
      return;
    }

    if (weight > remaining) {
      showAlert(
        "Validation",
        `${ploDisplayLabel(mappingModal.plo, mappingModal.ploIndex)} only has ${remaining}% left (column max is 100%). Enter ${remaining}% or less.`
      );
      return;
    }

    updateCell(String(mappingModal.course.courseId), mappingModal.plo.ploId, {
      mapped: true,
      weight,
    });
    closeMappingModal();
  };

  /** Count how many cells have mapped === true across all courses and PLOs */
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

    if (mappedCount === 0) {
      showAlert(
        "Nothing to save",
        "Select at least one checkbox to map a Course to a PLO before saving."
      );
      return;
    }

    const totals = columnTotals(matrix, courseIds, sortedPlos);
    const invalidColumns = sortedPlos
      .map((plo, index) => ({
        label: ploDisplayLabel(plo, index),
        total: totals[String(plo.ploId)] || 0,
      }))
      .filter(({ total }) => total > 0 && total !== 100);

    if (invalidColumns.length > 0) {
      showAlert(
        "Validation",
        `Each PLO column with mappings must total 100% across all courses. Check: ${invalidColumns
          .map(({ label, total }) => `${label} (${total}%)`)
          .join(", ")}`
      );
      return;
    }

    try {
      setSaving(true);
      savePloCourseMapping(program.programId, matrix);
      showAlert("Saved", `PLO–Course mapping saved successfully (${mappedCount} mapping${mappedCount === 1 ? "" : "s"}).`);
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
            {program.programName} · {user?.roleName || "HOD"}
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
          Only PLOs added for this program are shown. Restored PLOs from the PLO screen appear here automatically.
          Split contribution % across courses in each column — each used PLO must total <strong>100%</strong> (top row).
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
            <p className="mt-2 text-sm text-gray-500">
              Add PLOs under Program → PLOs first, then return here to map courses.
            </p>
          </div>
        ) : courses.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">
            No courses found. Add courses under Courses first.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-card">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-amber-50">
                  <th className="sticky left-0 z-20 min-w-[180px] border-r border-gray-200 bg-amber-50 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-600">
                    Total %
                  </th>
                  {sortedPlos.map((plo, index) => {
                    const key = String(plo.ploId);
                    const total = colTotals[key] || 0;
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
                  const courseKey = String(course.courseId);
                  const row = getCourseRow(matrix, courseKey, sortedPlos);

                  return (
                    <tr key={course.courseId} className="border-b border-gray-100 hover:bg-brand-muted/40/80">
                      <td className="sticky left-0 z-10 border-r border-gray-200 bg-white px-3 py-3">
                        <p className="font-semibold text-gray-900">{course.courseTitle}</p>
                        {course.courseCode ? (
                          <p className="text-xs text-gray-500">{course.courseCode}</p>
                        ) : null}
                      </td>
                      {sortedPlos.map((plo, ploIndex) => {
                        const ploKey = String(plo.ploId);
                        const cell = row[ploKey] || { mapped: false, weight: 0 };
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
                                    updateCell(courseKey, plo.ploId, { mapped: false, weight: 0 });
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
                                  title="Edit contribution %"
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
              <input
                type="number"
                min={1}
                max={mappingModal.remaining ?? 100}
                value={modalWeight}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setModalWeight("");
                    return;
                  }
                  const n = Number(raw);
                  if (Number.isNaN(n)) return;
                  const capped = Math.min(mappingModal.remaining ?? 100, Math.max(0, n));
                  setModalWeight(String(capped));
                }}
                className="mt-2 w-full rounded-2xl border border-gray-100 bg-white shadow-card px-3 py-2 text-sm"
                placeholder={`1 – ${mappingModal.remaining ?? 100}`}
                autoFocus
              />
            </label>
            <p className="mt-2 text-xs text-gray-500">
              Remaining for {ploDisplayLabel(mappingModal.plo, mappingModal.ploIndex)}:{" "}
              <strong>{mappingModal.remaining ?? 100}%</strong> (column cannot exceed 100%)
            </p>

            <button
              type="button"
              onClick={handleModalSave}
              className="mt-4 w-full rounded-lg py-3 font-black text-white"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={closeMappingModal}
              className="mt-3 w-full font-bold text-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
