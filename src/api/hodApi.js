import request from "./apiClient";
import { getOfferedCourses } from "./offeredCoursesApi";
import { getWeeklyContent } from "./teacherApi";
import { computeWeeklyProgressFromWeeks, folderStatusLabel } from "../utils/weeklyProgressHelpers";

function courseDedupeKey(course) {
  const sectionId = course.sectionId ?? course.SectionId;
  const courseId = course.courseId ?? course.CourseId;
  const teacherUserId = course.teacherUserId ?? course.TeacherUserId;

  if (sectionId != null && courseId != null && teacherUserId != null) {
    return `id:${sectionId}|${courseId}|${teacherUserId}`;
  }

  return `name:${(course.sectionName || "").trim().toLowerCase()}|${(course.courseTitle || "").trim().toLowerCase()}|${teacherUserId ?? ""}|${(course.teacherName || "").trim().toLowerCase()}`;
}

/** Same section + course + teacher should appear once on the HOD dashboard. */
function pickPreferredCourse(a, b) {
  if (Boolean(a.hasWeeklyContent) !== Boolean(b.hasWeeklyContent)) {
    return a.hasWeeklyContent ? a : b;
  }
  if ((a.coveredTopics ?? 0) !== (b.coveredTopics ?? 0)) {
    return (a.coveredTopics ?? 0) >= (b.coveredTopics ?? 0) ? a : b;
  }
  if ((a.weeklyProgressPercentage ?? 0) !== (b.weeklyProgressPercentage ?? 0)) {
    return (a.weeklyProgressPercentage ?? 0) >= (b.weeklyProgressPercentage ?? 0) ? a : b;
  }
  return (a.offeredCourseId ?? 0) >= (b.offeredCourseId ?? 0) ? a : b;
}

export function deduplicateHodCourses(courses = []) {
  const byId = new Map();
  for (const course of courses) {
    const id = course.offeredCourseId;
    if (id == null) continue;
    if (!byId.has(id)) byId.set(id, course);
  }

  const uniqueByOfferedId = Array.from(byId.values());
  const byAssignment = new Map();

  for (const course of uniqueByOfferedId) {
    const key = courseDedupeKey(course);
    const existing = byAssignment.get(key);
    byAssignment.set(key, existing ? pickPreferredCourse(existing, course) : course);
  }

  return Array.from(byAssignment.values()).sort(
    (a, b) => (a.offeredCourseId ?? 0) - (b.offeredCourseId ?? 0)
  );
}

function normalizeDashboardCourse(raw) {
  if (!raw || typeof raw !== "object") return raw;

  return {
    offeredCourseId: raw.offeredCourseId ?? raw.OfferedCourseId,
    sectionId: raw.sectionId ?? raw.SectionId ?? null,
    courseId: raw.courseId ?? raw.CourseId ?? null,
    teacherUserId: raw.teacherUserId ?? raw.TeacherUserId,
    teacherName: raw.teacherName ?? raw.TeacherName ?? "",
    sectionName: raw.sectionName ?? raw.SectionName ?? "",
    courseTitle: raw.courseTitle ?? raw.CourseTitle ?? "",
    courseCode: raw.courseCode ?? raw.CourseCode ?? "",
    programName: raw.programName ?? raw.ProgramName ?? "",
    programCode: raw.programCode ?? raw.ProgramCode ?? "",
    programCourseId: raw.programCourseId ?? raw.ProgramCourseId ?? null,
    weeklyProgressPercentage:
      raw.weeklyProgressPercentage ?? raw.WeeklyProgressPercentage ?? 0,
    coveredTopics: raw.coveredTopics ?? raw.CoveredTopics ?? 0,
    totalTopics: raw.totalTopics ?? raw.TotalTopics ?? 0,
    deviationTopics: raw.deviationTopics ?? raw.DeviationTopics ?? 0,
    hasWeeklyContent: raw.hasWeeklyContent ?? raw.HasWeeklyContent ?? false,
    progressLoading: raw.progressLoading ?? false,
    folderStatus: raw.folderStatus ?? raw.FolderStatus ?? folderStatusLabel(raw),
    isSubmitted:
      raw.isSubmitted ??
      raw.IsSubmitted ??
      raw.folderSubmitted ??
      raw.FolderSubmitted ??
      false,
  };
}

const EMPTY_PROGRESS = {
  totalTopics: 0,
  coveredTopics: 0,
  deviationTopics: 0,
  weeklyProgressPercentage: 0,
  hasWeeklyContent: false,
  progressLoading: false,
};

/** Fast list — one API call, no per-course weekly content. */
export async function getHodDashboardCoursesList() {
  try {
    const data = await request("/HodDashboard/courses");
    const list = Array.isArray(data) ? data : data?.courses ?? data?.Courses ?? [];
    return list.map((c) => normalizeDashboardCourse({ ...c, progressLoading: false }));
  } catch {
    const offered = await getOfferedCourses();
    const list = Array.isArray(offered) ? offered : [];
    return list.map((c) =>
      normalizeDashboardCourse({ ...c, ...EMPTY_PROGRESS, progressLoading: true })
    );
  }
}

/** Progress stats for a single offered course (full weekly content tree). */
export async function getHodCourseProgressSummary(offeredCourseId) {
  try {
    const weekly = await getWeeklyContent(offeredCourseId);
    const stats = computeWeeklyProgressFromWeeks(weekly?.weeks ?? []);
    return {
      ...stats,
      programCourseId: weekly?.programCourseId ?? null,
      progressLoading: false,
    };
  } catch {
    return { ...EMPTY_PROGRESS };
  }
}

/**
 * Load progress for many courses with limited concurrency so the UI stays responsive
 * and the server is not hit with dozens of simultaneous heavy requests.
 */
export async function enrichHodCoursesProgress(courses, { concurrency = 4, onProgress } = {}) {
  if (!courses?.length) return courses;

  const result = courses.map((c) => ({ ...c, progressLoading: c.progressLoading !== false }));

  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < result.length) {
      const i = nextIndex;
      nextIndex += 1;
      const course = result[i];
      const stats = await getHodCourseProgressSummary(course.offeredCourseId);
      result[i] = {
        ...course,
        ...stats,
        folderStatus: course.folderStatus || folderStatusLabel(course),
      };
      onProgress?.([...result]);
    }
  };

  const workers = Math.min(concurrency, result.length);
  await Promise.all(Array.from({ length: workers }, () => runWorker()));
  return result;
}

/** @deprecated Use getHodDashboardCoursesList + enrichHodCoursesProgress for faster UX. */
export async function getHodDashboardCourses() {
  const list = await getHodDashboardCoursesList();
  const allHaveProgress = list.length > 0 && list.every((c) => !c.progressLoading);
  if (allHaveProgress) return deduplicateHodCourses(list);
  const enriched = await enrichHodCoursesProgress(list);
  return deduplicateHodCourses(enriched);
}

export const getHodDashboardCoursesWithFallback = getHodDashboardCourses;
