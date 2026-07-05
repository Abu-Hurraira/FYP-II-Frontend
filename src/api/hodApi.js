import request from "./apiClient";
import { getOfferedCourses } from "./offeredCoursesApi";
import { getCourseFolderOverview, getWeeklyContentShared } from "./teacherApi";
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

  const result = {
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
    folderStatus: raw.folderStatus ?? raw.FolderStatus ?? "",
    isLocked:
      raw.isLocked ??
      raw.IsLocked ??
      raw.isFolderLocked ??
      raw.IsFolderLocked ??
      false,
    isFolderLocked:
      raw.isFolderLocked ??
      raw.IsFolderLocked ??
      raw.isLocked ??
      raw.IsLocked ??
      false,
    folderSubmitted: raw.folderSubmitted ?? raw.FolderSubmitted ?? false,
    isSubmitted:
      raw.isSubmitted ??
      raw.IsSubmitted ??
      raw.folderSubmitted ??
      raw.FolderSubmitted ??
      false,
  };

  result.folderStatus = result.folderStatus || folderStatusLabel(result);
  return result;
}

const EMPTY_PROGRESS = {
  totalTopics: 0,
  coveredTopics: 0,
  deviationTopics: 0,
  weeklyProgressPercentage: 0,
  hasWeeklyContent: false,
  progressLoading: false,
};

/** Fast list — one API call with progress and folder status from backend. */
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

/** Submitted folders — single API call (no per-course folder overview scan). */
export async function getHodSubmittedFolders() {
  try {
    const data = await request("/HodSubmission/submitted-folders");
    const list = Array.isArray(data) ? data : data?.folders ?? data?.Folders ?? [];
    return list.map((item) =>
      normalizeDashboardCourse({
        ...item,
        progressLoading: false,
        isLocked: true,
        isFolderLocked: true,
        folderStatus: item.folderStatus ?? item.FolderStatus ?? "Submitted",
        reviewStatus: item.reviewStatus ?? item.ReviewStatus ?? "Pending",
      })
    );
  } catch {
    return getHodSubmittedFoldersLegacy();
  }
}

/** Progress stats for a single offered course (full weekly content tree). */
export async function getHodCourseProgressSummary(offeredCourseId) {
  try {
    const weekly = await getWeeklyContentShared(offeredCourseId);
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

function folderReviewStatus(overview) {
  return String(
    overview?.hodReviewStatus ??
      overview?.HodReviewStatus ??
      overview?.reviewStatus ??
      overview?.ReviewStatus ??
      overview?.submissionReviewStatus ??
      overview?.SubmissionReviewStatus ??
      overview?.submissionStatus ??
      overview?.SubmissionStatus ??
      "Pending"
  ).trim();
}

function isFolderLockedOverview(overview) {
  return Boolean(
    overview?.isLocked ??
      overview?.IsLocked ??
      String(overview?.folderStatus ?? overview?.FolderStatus ?? "").toLowerCase() === "submitted"
  );
}

/** @deprecated Slow N+1 scan — kept as fallback only. */
async function getHodSubmittedFoldersLegacy({ concurrency = 4 } = {}) {
  const [dashboardList, offeredRaw] = await Promise.all([
    getHodDashboardCoursesList().catch(() => []),
    getOfferedCourses().catch(() => []),
  ]);

  const offeredList = (Array.isArray(offeredRaw) ? offeredRaw : []).map((c) =>
    normalizeDashboardCourse({ ...c, progressLoading: false })
  );

  const list = deduplicateHodCourses([...dashboardList, ...offeredList]);
  if (!list.length) return [];

  const submitted = [];
  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < list.length) {
      const i = nextIndex;
      nextIndex += 1;
      const course = list[i];

      try {
        const overview = await getCourseFolderOverview(course.offeredCourseId);
        const locked = isFolderLockedOverview(overview);
        if (!locked || overview?.isCreated === false) continue;

        const reviewStatus = folderReviewStatus(overview);

        submitted.push({
          ...course,
          isLocked: true,
          isFolderLocked: true,
          folderStatus: "Submitted",
          reviewStatus,
          rootFolderName: overview?.rootFolderName ?? overview?.RootFolderName ?? "",
        });
      } catch {
        // Skip courses without a folder record.
      }
    }
  };

  const workers = Math.min(concurrency, list.length);
  await Promise.all(Array.from({ length: workers }, () => runWorker()));

  return submitted.sort((a, b) => (a.offeredCourseId ?? 0) - (b.offeredCourseId ?? 0));
}
