import {
  EMPTY_UPLOAD_ALLOCATION_ROW,
  FULL_UPLOAD_ALLOCATION_ROW,
} from "../constants/uploadAllocationTypes";

const STORAGE_KEY = "hod-upload-allocation";

export function getCourseGroupKey(course) {
  return String(
    course.courseId ?? course.CourseId ?? course.courseTitle ?? course.CourseTitle ?? ""
  )
    .trim()
    .toLowerCase();
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
  return {
    clos: Boolean(raw.clos ?? raw.CanUploadCLOs),
    mid: Boolean(raw.mid ?? raw.CanUploadMid),
    final: Boolean(raw.final ?? raw.CanUploadFinal),
    folderTemplate: Boolean(raw.folderTemplate ?? raw.CanUploadFolderTemplate),
  };
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

export function loadUploadAllocationConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeAllocationConfig(null);
    return normalizeAllocationConfig(JSON.parse(raw));
  } catch {
    return normalizeAllocationConfig(null);
  }
}

export function saveUploadAllocationConfig(config) {
  const payload = {
    configured: Boolean(config?.configured),
    allocations: config?.allocations ?? {},
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

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

export function pickSectionARow(courses = []) {
  return courses.find((row) => isSectionA(row.sectionName ?? row.SectionName)) ?? courses[0];
}

export function rowHasAnyPermission(row) {
  return Boolean(row?.clos || row?.mid || row?.final || row?.folderTemplate);
}

/** Group offered courses by course id/title and pick Section A row for defaults. */
export function buildDefaultAllocations(offeredCourses = []) {
  const allocations = {};
  for (const courses of groupOfferedCoursesByCourse(offeredCourses).values()) {
    if (!courses.length) continue;
    const target = courses.length === 1 ? courses[0] : pickSectionARow(courses);
    const offeredCourseId = target.offeredCourseId ?? target.OfferedCourseId;
    if (offeredCourseId == null) continue;
    allocations[String(offeredCourseId)] = { ...FULL_UPLOAD_ALLOCATION_ROW };
  }
  return allocations;
}

/**
 * Save rules:
 * - No manual ticks anywhere → Section A (or only section) full per course
 * - Single-section course → always full allocation on that row
 * - HOD edits one or more courses → those courses use exact draft; other courses → Section A auto
 */
export function buildAllocationsForSave(offeredCourses = [], draftRows = {}) {
  const groups = groupOfferedCoursesByCourse(offeredCourses);
  const result = {};

  const manuallyEditedGroups = new Set();
  for (const [groupKey, courses] of groups) {
    const edited = courses.some((course) => {
      const row = normalizeAllocationRow(draftRows[String(course.offeredCourseId)]);
      return rowHasAnyPermission(row);
    });
    if (edited) manuallyEditedGroups.add(groupKey);
  }

  const noManualEdits = manuallyEditedGroups.size === 0;

  for (const [groupKey, courses] of groups) {
    if (courses.length === 1) {
      const offeredCourseId = courses[0].offeredCourseId ?? courses[0].OfferedCourseId;
      if (offeredCourseId != null) {
        result[String(offeredCourseId)] = { ...FULL_UPLOAD_ALLOCATION_ROW };
      }
      continue;
    }

    if (noManualEdits) {
      const sectionA = pickSectionARow(courses);
      const offeredCourseId = sectionA.offeredCourseId ?? sectionA.OfferedCourseId;
      if (offeredCourseId != null) {
        result[String(offeredCourseId)] = { ...FULL_UPLOAD_ALLOCATION_ROW };
      }
      continue;
    }

    if (manuallyEditedGroups.has(groupKey)) {
      for (const course of courses) {
        const id = String(course.offeredCourseId);
        const draft = normalizeAllocationRow(draftRows[id]);
        if (rowHasAnyPermission(draft)) {
          result[id] = { ...draft };
        }
      }
      continue;
    }

    const sectionA = pickSectionARow(courses);
    const offeredCourseId = sectionA.offeredCourseId ?? sectionA.OfferedCourseId;
    if (offeredCourseId != null) {
      result[String(offeredCourseId)] = { ...FULL_UPLOAD_ALLOCATION_ROW };
    }
  }

  return result;
}

export function getAllocationForOfferedCourse(offeredCourseId, config) {
  const normalized = normalizeAllocationConfig(config);
  if (!normalized.configured) {
    return { ...FULL_UPLOAD_ALLOCATION_ROW };
  }
  const row = normalized.allocations[String(offeredCourseId)];
  return row ? normalizeAllocationRow(row) : { ...EMPTY_UPLOAD_ALLOCATION_ROW };
}

export function canTeacherUpload(offeredCourseId, uploadType, config) {
  const row = getAllocationForOfferedCourse(offeredCourseId, config);
  return Boolean(row[uploadType]);
}
