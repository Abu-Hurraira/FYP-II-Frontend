import request from "./apiClient";
import { getOfferedCourses, getOfferedCoursesBySession } from "./offeredCoursesApi";
import { getSessions } from "./sessionsApi";
import { getWeeklyContentShared } from "./teacherApi";
import { asList } from "../utils/helpers";
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
    reviewStatus: raw.reviewStatus ?? raw.ReviewStatus ?? "",
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

/** Fast paginated list — progress computed server-side for the current page only. */
export async function getHodDashboardCoursesPage({
  page = 1,
  pageSize = 12,
  search = "",
  lite = false,
  hodUserId,
} = {}) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (search?.trim()) params.set("search", search.trim());
  if (lite) params.set("lite", "true");
  if (hodUserId != null && hodUserId !== "") params.set("hodUserId", String(hodUserId));

  const data = await request(`/HodDashboard/courses?${params.toString()}`, { timeoutMs: 12000 });
  const itemsRaw = Array.isArray(data) ? data : data?.items ?? data?.Items ?? [];
  const items = itemsRaw.map((c) => normalizeDashboardCourse({ ...c, progressLoading: false }));

  return {
    items: deduplicateHodCourses(items),
    page: data?.page ?? data?.Page ?? page,
    pageSize: data?.pageSize ?? data?.PageSize ?? pageSize,
    totalCount: data?.totalCount ?? data?.TotalCount ?? items.length,
    hasMore: Boolean(data?.hasMore ?? data?.HasMore ?? false),
  };
}

/** @deprecated Prefer getHodDashboardCoursesPage — kept for callers that need a full list. */
export async function getHodDashboardCoursesList() {
  try {
    const page = await getHodDashboardCoursesPage({ page: 1, pageSize: 48 });
    return page.items;
  } catch {
    const fallback = await getOfferedCoursesFallbackPage({ page: 1, pageSize: 48 });
    return fallback.items;
  }
}

/**
 * Client-side paginated fallback when the dashboard API is unavailable.
 * Still avoids loading progress for every course at once.
 */
export async function getOfferedCoursesFallbackPage({ page = 1, pageSize = 12, search = "" } = {}) {
  let offered = [];
  try {
    offered = asList(await getOfferedCourses());
  } catch {
    offered = [];
  }

  if (offered.length === 0) {
    const sessions = asList(await getSessions().catch(() => []));
    const batches = await Promise.all(
      sessions.map((session) =>
        getOfferedCoursesBySession(session.sessionId ?? session.SessionId).catch(() => [])
      )
    );
    offered = batches.flatMap((rows) => asList(rows));
  }

  const list = offered.map((c) =>
    normalizeDashboardCourse({ ...c, ...EMPTY_PROGRESS, progressLoading: true })
  );

  const deduped = deduplicateHodCourses(list);
  const q = search.trim().toLowerCase();
  const filtered = !q
    ? deduped
    : deduped.filter((c) =>
        [c.teacherName, c.sectionName, c.courseTitle, c.courseCode, c.programName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );

  const start = (Math.max(page, 1) - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return {
    items,
    page: Math.max(page, 1),
    pageSize,
    totalCount: filtered.length,
    hasMore: start + pageSize < filtered.length,
  };
}

/** Submitted folders — single API call. Never falls back to the N+1 scan (that hung the UI). */
export async function getHodSubmittedFolders(hodUserId) {
  if (hodUserId == null || hodUserId === "" || Number.isNaN(Number(hodUserId))) {
    return [];
  }

  const data = await request(`/HodDashboard/${hodUserId}/submitted-folders`);
  const list = Array.isArray(data) ? data : data?.folders ?? data?.Folders ?? [];
  return list.map((item) => ({
    ...normalizeDashboardCourse({
      ...item,
      progressLoading: false,
      isLocked: true,
      isFolderLocked: true,
      folderStatus: item.folderStatus ?? item.FolderStatus ?? "Submitted",
    }),
    reviewStatus:
      item.reviewStatus ??
      item.ReviewStatus ??
      (String(item.folderStatus ?? item.FolderStatus ?? "").toLowerCase() === "approved"
        ? "Approved"
        : "Pending"),
    overallProgressPercent:
      item.overallProgressPercent ?? item.OverallProgressPercent ?? 0,
    submittedAt: item.submittedAt ?? item.SubmittedAt ?? null,
  }));
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
