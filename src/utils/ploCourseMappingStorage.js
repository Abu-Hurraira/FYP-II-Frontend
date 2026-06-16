import { ploDisplayLabel, sortPlos } from "./outcomeHelpers";

export { sortPlos, ploDisplayLabel };

const storageKey = (programId) => `hod-plo-course-mapping-${programId}`;

export function emptyMappingCell() {
  return { mapped: false, weight: 0 };
}

/** Migrate legacy index-array storage to ploId-keyed objects. */
export function normalizeMatrix(raw, plos) {
  if (!raw || typeof raw !== "object") return {};
  const sorted = sortPlos(plos);
  const result = {};

  for (const [courseId, row] of Object.entries(raw)) {
    if (Array.isArray(row)) {
      result[courseId] = {};
      sorted.forEach((plo, index) => {
        if (row[index]) {
          result[courseId][plo.ploId] = row[index];
        }
      });
    } else if (row && typeof row === "object") {
      result[courseId] = { ...row };
    }
  }
  return result;
}

export function loadPloCourseMapping(programId, plos) {
  try {
    const raw = localStorage.getItem(storageKey(programId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return normalizeMatrix(parsed, plos);
  } catch {
    return {};
  }
}

export function savePloCourseMapping(programId, matrix) {
  localStorage.setItem(storageKey(programId), JSON.stringify(matrix));
}

export function getCourseRow(matrix, courseId, plos) {
  if (!matrix[courseId]) {
    matrix[courseId] = {};
  }
  for (const plo of plos) {
    const key = String(plo.ploId);
    if (!matrix[courseId][key]) {
      matrix[courseId][key] = emptyMappingCell();
    }
  }
  return matrix[courseId];
}

export function columnTotals(matrix, courseIds, plos) {
  const totals = {};
  for (const plo of plos) {
    totals[String(plo.ploId)] = 0;
  }
  for (const courseId of courseIds) {
    const row = matrix[courseId] || {};
    for (const plo of plos) {
      const key = String(plo.ploId);
      const cell = row[key];
      if (cell?.mapped) {
        totals[key] += Number(cell.weight) || 0;
      }
    }
  }
  return totals;
}
