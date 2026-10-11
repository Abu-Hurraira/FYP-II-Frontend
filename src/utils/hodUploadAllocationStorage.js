import {
  EMPTY_UPLOAD_ALLOCATION_ROW,
  FULL_UPLOAD_ALLOCATION_ROW,
} from "../constants/uploadAllocationTypes";

export function getCourseGroupKey(course) {
  return String(
    course.courseId ?? course.CourseId ?? course.courseTitle ?? course.CourseTitle ?? ""
  )
    .trim()
    .toLowerCase();
}

/** All sections of the same subject (every teacher), e.g. Applied Physics. */
export function groupOfferedCoursesByCourse(offeredCourses = []) {
  const groups = new Map();
  for (const course of offeredCourses) {
    const key = getCourseGroupKey(course);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(course);
  }
  return groups;
}

/** Section A: BAI-6A, BCS-5A, plain A, Section A, etc. */
export function isSectionA(sectionName) {
  const normalized = String(sectionName || "").trim().toUpperCase();
  if (!normalized) return false;
  if (normalized === "A" || normalized === "SECTION A") return true;
  return /\dA$/.test(normalized) || /-A$/.test(normalized);
}

export function normalizeAllocationRow(raw) {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_UPLOAD_ALLOCATION_ROW };
  }
  const hasClos = Boolean(raw.clos ?? raw.Clos ?? raw.CanUploadCLOs);
  return {
    clos: hasClos,
    cloPloMapping: Boolean(raw.cloPloMapping ?? raw.CloPloMapping ?? raw.CanManageCloPloMapping ?? hasClos),
    cloTaskMapping: Boolean(raw.cloTaskMapping ?? raw.CloTaskMapping ?? raw.CanManageCloTaskMapping ?? hasClos),
    mid: Boolean(raw.mid ?? raw.Mid ?? raw.CanUploadMid),
    final: Boolean(raw.final ?? raw.Final ?? raw.CanUploadFinal),
    folderTemplate: Boolean(raw.folderTemplate ?? raw.FolderTemplate ?? raw.CanUploadFolderTemplate),
  };
}

export function configHasAnyTicks(config) {
  return Object.values(config?.allocations ?? {}).some((row) => rowHasAnyPermission(row));
}

export function normalizeAllocationConfig(raw) {
  if (!raw || typeof raw !== "object") {
    return { configured: false, allocations: {} };
  }

  const allocations = {};
  const source = raw.allocations ?? raw.Allocations ?? {};
  for (const [offeredCourseId, row] of Object.entries(source)) {
    allocations[String(offeredCourseId)] = normalizeAllocationRow(row);
  }

  return {
    configured: Boolean(raw.configured ?? raw.Configured),
    allocations,
    updatedAt: raw.updatedAt ?? raw.UpdatedAt ?? null,
  };
}

export function pickFirstSectionARow(courses = []) {
  const sorted = [...courses].sort((a, b) => {
    const sectionCmp = String(a.sectionName ?? a.SectionName ?? "").localeCompare(
      String(b.sectionName ?? b.SectionName ?? ""),
      undefined,
      { numeric: true }
    );
    if (sectionCmp !== 0) return sectionCmp;
    return String(a.programName ?? a.ProgramName ?? "").localeCompare(
      String(b.programName ?? b.ProgramName ?? "")
    );
  });
  return sorted.find((row) => isSectionA(row.sectionName ?? row.SectionName)) ?? sorted[0];
}

export function pickSectionARow(courses = []) {
  return courses.find((row) => isSectionA(row.sectionName ?? row.SectionName)) ?? courses[0];
}

export function rowHasAnyPermission(row) {
  return Boolean(row?.clos || row?.cloPloMapping || row?.cloTaskMapping || row?.mid || row?.final || row?.folderTemplate);
}

function courseIdOf(course) {
  return course?.offeredCourseId ?? course?.OfferedCourseId;
}

/**
 * Auto allocation: exactly one Section A per subject (first A of that course).
 * Example: Adv Database → BSAI-6A only. BSCS-5A / BSSE-6A stay unticked.
 */
export function buildSectionAAllocations(offeredCourses = []) {
  const allocations = {};

  for (const courses of groupOfferedCoursesByCourse(offeredCourses).values()) {
    if (!courses.length) continue;
    const target = pickFirstSectionARow(courses);
    const targetId = String(courseIdOf(target ?? {}));

    for (const course of courses) {
      const id = String(courseIdOf(course));
      if (!id || id === "undefined") continue;
      allocations[id] =
        id === targetId && targetId !== "undefined"
          ? { ...FULL_UPLOAD_ALLOCATION_ROW }
          : { ...EMPTY_UPLOAD_ALLOCATION_ROW };
    }
  }

  return allocations;
}

/** How many current table rows actually have a tick. */
export function countVisibleTicks(offeredCourses = [], allocations = {}) {
  return offeredCourses.filter((course) =>
    rowHasAnyPermission(normalizeAllocationRow(allocations[String(courseIdOf(course))]))
  ).length;
}

export function rowsEqual(a, b) {
  const left = normalizeAllocationRow(a);
  const right = normalizeAllocationRow(b);
  return (
    left.clos === right.clos &&
    left.cloPloMapping === right.cloPloMapping &&
    left.cloTaskMapping === right.cloTaskMapping &&
    left.mid === right.mid &&
    left.final === right.final &&
    left.folderTemplate === right.folderTemplate
  );
}

/**
 * Auto Section A only when nothing was allocated before AND the HOD did not tick anything.
 * Otherwise save the exact checkboxes (manual allocation).
 */
export function buildAllocationsForSave(offeredCourses = [], draftRows = {}, { hasPriorAllocation = false } = {}) {
  const hasManual = offeredCourses.some((course) =>
    rowHasAnyPermission(normalizeAllocationRow(draftRows[String(courseIdOf(course))]))
  );

  if (!hasPriorAllocation && !hasManual) {
    return buildSectionAAllocations(offeredCourses);
  }

  const result = {};
  for (const course of offeredCourses) {
    const id = String(courseIdOf(course));
    if (!id || id === "undefined") continue;
    result[id] = normalizeAllocationRow(draftRows[id]);
  }
  return result;
}

export function getAllocationForOfferedCourse(offeredCourseId, config) {
  const normalized = normalizeAllocationConfig(config);
  if (!normalized.configured) {
    return { ...EMPTY_UPLOAD_ALLOCATION_ROW };
  }
  const row = normalized.allocations[String(offeredCourseId)];
  return row ? normalizeAllocationRow(row) : { ...EMPTY_UPLOAD_ALLOCATION_ROW };
}

export function canTeacherUpload(offeredCourseId, uploadType, config) {
  const row = getAllocationForOfferedCourse(offeredCourseId, config);
  return Boolean(row[uploadType]);
}
