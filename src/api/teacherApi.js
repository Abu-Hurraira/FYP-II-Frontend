import request, { API_BASE_URL, getAuthToken } from "./apiClient";
import { getOfferedCourses } from "./offeredCoursesApi";
import { appendFormFile } from "../utils/appendFormFile";
import { asList } from "../utils/helpers";
import {
  findSameSubjectPeers,
  normalizeWeeklyContent,
  subjectKeyForCourse,
  weeklyContentHasTopics,
} from "../utils/weeklyContentSharing";
import { computeWeeklyProgressFromWeeks } from "../utils/weeklyProgressHelpers";

/** Safe parse for API booleans (1/0, "true"/"false", Newtonsoft quirks). */
function parseJsonBool(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value === null || value === undefined) return false;
  if (typeof value === "string") {
    const t = value.trim().toLowerCase();
    if (t === "true" || t === "1" || t === "yes") return true;
    if (t === "false" || t === "0" || t === "no" || t === "") return false;
  }
  return Boolean(value);
}

/** ASP.NET may serialize with PascalCase; normalize for the UI. */
function normalizeTeacherSynchronizationDto(raw) {
  if (!raw || typeof raw !== "object") {
    return raw;
  }

  const teachersRaw = raw.teachers ?? raw.Teachers ?? [];
  const teachers = teachersRaw.map((t) => ({
    offeredCourseId: t.offeredCourseId ?? t.OfferedCourseId,
    teacherUserId: t.teacherUserId ?? t.TeacherUserId,
    teacherName: t.teacherName ?? t.TeacherName ?? "",
    sectionName: t.sectionName ?? t.SectionName ?? "",
    columnLabel: t.columnLabel ?? t.ColumnLabel ?? "",
  }));

  const matrixRaw = raw.matrix ?? raw.Matrix ?? [];
  const matrix = matrixRaw.map((row) => ({
    topicId: row.topicId ?? row.TopicId,
    weekNo: row.weekNo ?? row.WeekNo,
    topicName: row.topicName ?? row.TopicName ?? "",
    statuses: (row.statuses ?? row.Statuses ?? []).map((s) => ({
      offeredCourseId: s.offeredCourseId ?? s.OfferedCourseId,
      teacherUserId: s.teacherUserId ?? s.TeacherUserId,
      teacherName: s.teacherName ?? s.TeacherName ?? "",
      sectionName: s.sectionName ?? s.SectionName ?? "",
      isCompleted: parseJsonBool(s.isCompleted ?? s.IsCompleted),
    })),
  }));

  const commonTopics = (raw.commonTopics ?? raw.CommonTopics ?? []).map((t) => ({
    topicId: t.topicId ?? t.TopicId,
    weekNo: t.weekNo ?? t.WeekNo,
    topicName: t.topicName ?? t.TopicName ?? "",
    statusLabel: t.statusLabel ?? t.StatusLabel ?? "COMMON",
  }));

  const gapTopics = (raw.gapTopics ?? raw.GapTopics ?? []).map((g) => ({
    topicId: g.topicId ?? g.TopicId,
    weekNo: g.weekNo ?? g.WeekNo,
    topicName: g.topicName ?? g.TopicName ?? "",
    missingInTeacher: g.missingInTeacher ?? g.MissingInTeacher ?? "",
    missingInSection: g.missingInSection ?? g.MissingInSection ?? "",
    coveredByCount: g.coveredByCount ?? g.CoveredByCount ?? 0,
    gapLevel: g.gapLevel ?? g.GapLevel ?? "",
    coveredByTeachers: g.coveredByTeachers ?? g.CoveredByTeachers ?? [],
  }));

  return {
    ...raw,
    currentOfferedCourseId: raw.currentOfferedCourseId ?? raw.CurrentOfferedCourseId,
    programCourseId: raw.programCourseId ?? raw.ProgramCourseId,
    courseTitle: raw.courseTitle ?? raw.CourseTitle ?? "",
    currentTeacherName: raw.currentTeacherName ?? raw.CurrentTeacherName ?? "",
    currentSectionName: raw.currentSectionName ?? raw.CurrentSectionName ?? "",
    teachers,
    matrix,
    commonTopics,
    gapTopics,
  };
}

function normalizeTeacherCourseCard(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const folderStatus = raw.folderStatus ?? raw.FolderStatus ?? "Open";
  return {
    offeredCourseId: raw.offeredCourseId ?? raw.OfferedCourseId,
    courseId: raw.courseId ?? raw.CourseId,
    programCourseId: raw.programCourseId ?? raw.ProgramCourseId ?? 0,
    courseTitle: raw.courseTitle ?? raw.CourseTitle ?? "",
    courseCode: raw.courseCode ?? raw.CourseCode ?? "",
    programCode: raw.programCode ?? raw.ProgramCode ?? "",
    programName: raw.programName ?? raw.ProgramName ?? "",
    sectionName: raw.sectionName ?? raw.SectionName ?? "",
    teacherName: raw.teacherName ?? raw.TeacherName ?? "",
    hasWeeklyContent: raw.hasWeeklyContent ?? raw.HasWeeklyContent ?? false,
    weeklyProgressPercentage: raw.weeklyProgressPercentage ?? raw.WeeklyProgressPercentage ?? 0,
    coveredTopics: raw.coveredTopics ?? raw.CoveredTopics ?? 0,
    totalTopics: raw.totalTopics ?? raw.TotalTopics ?? 0,
    folderStatus,
    isLocked: raw.isLocked ?? raw.IsLocked ?? false,
    reviewStatus: raw.reviewStatus ?? raw.ReviewStatus ?? null,
  };
}

export async function getTeacherCourses(teacherUserId) {
  const raw = await request(`/TeacherDashboard/${teacherUserId}/courses`);
  const list = Array.isArray(raw) ? raw : raw?.items ?? raw?.Items ?? [];
  return list.map(normalizeTeacherCourseCard);
}

/** Paginated teacher home list with folder status and weekly progress included. */
export async function getTeacherCoursesPage({ teacherUserId, page = 1, pageSize = 12 } = {}) {
  const params = new URLSearchParams({
    page: String(Math.max(1, page)),
    pageSize: String(Math.min(Math.max(pageSize, 1), 48)),
  });
  const data = await request(`/TeacherDashboard/${teacherUserId}/courses?${params.toString()}`);

  if (Array.isArray(data)) {
    const start = (Math.max(page, 1) - 1) * pageSize;
    const items = data.slice(start, start + pageSize).map(normalizeTeacherCourseCard);
    return {
      items,
      page: Math.max(page, 1),
      pageSize,
      totalCount: data.length,
      hasMore: start + pageSize < data.length,
    };
  }

  const itemsRaw = data?.items ?? data?.Items ?? [];
  return {
    items: itemsRaw.map(normalizeTeacherCourseCard),
    page: data?.page ?? data?.Page ?? page,
    pageSize: data?.pageSize ?? data?.PageSize ?? pageSize,
    totalCount: data?.totalCount ?? data?.TotalCount ?? itemsRaw.length,
    hasMore: Boolean(data?.hasMore ?? data?.HasMore ?? false),
  };
}

/** Merge dashboard + submission course lists so teachers see every assigned course. */
export function mergeTeacherCourses(...lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const course of list || []) {
      const id = course?.offeredCourseId ?? course?.OfferedCourseId;
      if (id == null) continue;
      byId.set(Number(id), { ...(byId.get(Number(id)) || {}), ...course });
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => String(a.courseTitle ?? "").localeCompare(String(b.courseTitle ?? "")) ||
      String(a.sectionName ?? "").localeCompare(String(b.sectionName ?? ""), undefined, { numeric: true })
  );
}

export async function getAllTeacherCourses(teacherUserId) {
  try {
    return mergeTeacherCourses(await getTeacherCourses(teacherUserId));
  } catch {
    const submission = await getTeacherSubmissionCourses(teacherUserId).catch(() => []);
    return mergeTeacherCourses(Array.isArray(submission) ? submission : []);
  }
}

export async function getCourseMenu(offeredCourseId, teacherUserId) {
  const qs =
    teacherUserId != null && teacherUserId !== ""
      ? `?teacherUserId=${encodeURIComponent(teacherUserId)}`
      : "";
  const raw = await request(`/TeacherDashboard/course-menu/${offeredCourseId}${qs}`);
  const permissions = raw.permissions ?? raw.Permissions ?? {};
  return {
    offeredCourseId: raw.offeredCourseId ?? raw.OfferedCourseId,
    courseId: raw.courseId ?? raw.CourseId,
    programCourseId: raw.programCourseId ?? raw.ProgramCourseId,
    courseTitle: raw.courseTitle ?? raw.CourseTitle ?? "",
    courseCode: raw.courseCode ?? raw.CourseCode ?? "",
    sectionName: raw.sectionName ?? raw.SectionName ?? "",
    teacherName: raw.teacherName ?? raw.TeacherName ?? "",
    permissions: {
      canManageClos: Boolean(permissions.canManageClos ?? permissions.CanManageClos),
      canUploadWeeklyContent: Boolean(
        permissions.canUploadWeeklyContent ?? permissions.CanUploadWeeklyContent
      ),
      canUploadMidExamQuestions: Boolean(
        permissions.canUploadMidExamQuestions ?? permissions.CanUploadMidExamQuestions
      ),
      canUploadFinalExamQuestions: Boolean(
        permissions.canUploadFinalExamQuestions ?? permissions.CanUploadFinalExamQuestions
      ),
      canManageCloPloMapping: Boolean(
        permissions.canManageCloPloMapping ?? permissions.CanManageCloPloMapping
      ),
      canManageCloTaskMapping: Boolean(
        permissions.canManageCloTaskMapping ?? permissions.CanManageCloTaskMapping
      ),
    },
  };
}

export async function getAssessmentSummary(offeredCourseId, teacherUserId) {
  return await request(
    `/Assessments/offered-course/${offeredCourseId}/summary?teacherUserId=${teacherUserId || ""}`
  );
}

export async function saveCloTaskCell(programCourseId, payload) {
  return await request(`/CloTaskMappings/program-course/${programCourseId}/cell`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getCloTaskMatrix(programCourseId, teacherUserId, offeredCourseId) {
  return await request(
    `/CloTaskMappings/program-course/${programCourseId}/matrix?teacherUserId=${teacherUserId || ""}&offeredCourseId=${offeredCourseId || ""}`
  );
}

export async function addCloTaskType(programCourseId, payload) {
  return await request(`/CloTaskMappings/program-course/${programCourseId}/tasks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function removeCloTaskType(programCourseId, assessmentTypeId, payload) {
  return await request(`/CloTaskMappings/program-course/${programCourseId}/tasks/${assessmentTypeId}`, {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}

export async function getAssessmentLoadSchemes(offeredCourseId, teacherUserId, assessmentTypeName) {
  const typeQs = assessmentTypeName
    ? `&assessmentTypeName=${encodeURIComponent(assessmentTypeName)}`
    : "";
  return await request(
    `/Assessments/offered-course/${offeredCourseId}/load-sources/schemes?teacherUserId=${teacherUserId || ""}${typeQs}`
  );
}

export async function getAssessmentLoadSchemeItems(
  offeredCourseId,
  sourceSessionId,
  teacherUserId,
  assessmentTypeName
) {
  const typeQs = assessmentTypeName
    ? `&assessmentTypeName=${encodeURIComponent(assessmentTypeName)}`
    : "";
  return await request(
    `/Assessments/offered-course/${offeredCourseId}/load-sources/schemes/${sourceSessionId}/items?teacherUserId=${teacherUserId || ""}${typeQs}`
  );
}

export async function applyAssessmentLoadScheme(offeredCourseId, payload) {
  return await request(`/Assessments/offered-course/${offeredCourseId}/load-sources/apply`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getWeeklyLoadSchemes(offeredCourseId, teacherUserId) {
  return await request(
    `/TeacherWeeklyContent/${offeredCourseId}/load-sources/schemes?teacherUserId=${teacherUserId || ""}`
  );
}

export async function getWeeklyLoadSchemeTopics(offeredCourseId, sourceSessionId, teacherUserId) {
  return await request(
    `/TeacherWeeklyContent/${offeredCourseId}/load-sources/schemes/${sourceSessionId}/topics?teacherUserId=${teacherUserId || ""}`
  );
}

export async function applyWeeklyLoadScheme(offeredCourseId, payload) {
  return await request(`/TeacherWeeklyContent/${offeredCourseId}/load-sources/apply`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCloPloMatrix(programCourseId, teacherUserId, offeredCourseId) {
  return await request(
    `/PLOCLOMappings/program-course/${programCourseId}/matrix?teacherUserId=${teacherUserId || ""}&offeredCourseId=${offeredCourseId || ""}`
  );
}

export async function saveCloPloCell(programCourseId, payload) {
  return await request(`/PLOCLOMappings/program-course/${programCourseId}/cell`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function submitContentForReview(programCourseId, payload) {
  return await request(`/ContentSubmission/program-course/${programCourseId}/submit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getContentStatuses(programCourseId, teacherUserId, offeredCourseId) {
  return await request(
    `/ContentSubmission/program-course/${programCourseId}/status?teacherUserId=${teacherUserId || ""}&offeredCourseId=${offeredCourseId || ""}`
  );
}

export async function getAssessmentsList(offeredCourseId, teacherUserId, typeName = "Assignment") {
  return asList(
    await request(
      `/Assessments/offered-course/${offeredCourseId}?teacherUserId=${teacherUserId || ""}&assessmentTypeName=${typeName}`
    )
  );
}

export async function getAvailableClos(offeredCourseId, teacherUserId, assessmentTypeName) {
  const typeParam = assessmentTypeName ? `&assessmentTypeName=${encodeURIComponent(assessmentTypeName)}` : "";
  return asList(
    await request(
      `/Assessments/offered-course/${offeredCourseId}/available-clos?teacherUserId=${teacherUserId || ""}${typeParam}`
    )
  );
}

export async function createAssessment(payload) {
  return await request("/Assessments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAssessmentDetail(assessmentId, teacherUserId) {
  return await request(
    `/Assessments/${assessmentId}?teacherUserId=${teacherUserId || ""}`
  );
}

export async function updateAssessment(assessmentId, payload) {
  return await request(`/Assessments/${assessmentId}/meta`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function completeAssessmentSetup(assessmentId, teacherUserId) {
  return await request(`/Assessments/${assessmentId}/complete-setup`, {
    method: "POST",
    body: JSON.stringify({ teacherUserId }),
  });
}

export async function reopenAssessmentSetup(assessmentId, teacherUserId) {
  return await request(`/Assessments/${assessmentId}/reopen-setup`, {
    method: "POST",
    body: JSON.stringify({ teacherUserId }),
  });
}

export async function addAssessmentQuestion(assessmentId, payload) {
  return await request(`/Assessments/${assessmentId}/questions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAssessmentQuestion(assessmentId, questionId, payload) {
  return await request(`/Assessments/${assessmentId}/questions/${questionId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function parseQuestionPaper(assessmentId, teacherUserId) {
  return await request(
    `/Assessments/${assessmentId}/parse-question-paper?teacherUserId=${teacherUserId || ""}`,
    { method: "POST" }
  );
}

export async function uploadAssessmentFile(assessmentId, teacherUserId, filePurpose, file) {
  const formData = new FormData();
  formData.append("teacherUserId", String(teacherUserId));
  formData.append("filePurpose", filePurpose);
  appendFormFile(formData, "file", file, file?.name || "assessment-file");

  return await request(`/Assessments/${assessmentId}/files`, {
    method: "POST",
    body: formData,
    timeoutMs: 60000,
  });
}

export async function getWeeklyContent(offeredCourseId, teacherUserId) {
  const qs =
    teacherUserId != null && teacherUserId !== ""
      ? `?teacherUserId=${encodeURIComponent(teacherUserId)}`
      : "";
  return await request(`/TeacherWeeklyContent/${offeredCourseId}${qs}`);
}

export async function loadWeeklyContentFromDatabase(offeredCourseId, teacherUserId) {
  const qs =
    teacherUserId != null && teacherUserId !== ""
      ? `?teacherUserId=${encodeURIComponent(teacherUserId)}`
      : "";
  return await request(`/TeacherWeeklyContent/${offeredCourseId}/load-from-database${qs}`, {
    method: "POST",
  });
}

/**
 * Weekly content is uploaded per section but should be visible to every teacher
 * teaching the same subject. Tries own section, DB sync, then sibling sections.
 * Progress always comes from the requested section — never from a peer section.
 */
export async function getWeeklyContentShared(offeredCourseId, teacherUserId) {
  const ocId = Number(offeredCourseId);

  const finalize = (data, extra = {}) =>
    normalizeWeeklyContent({ ...data, offeredCourseId: ocId, ...extra });

  let primary = null;
  try {
    primary = finalize(await getWeeklyContent(ocId, teacherUserId));
    if (weeklyContentHasTopics(primary)) {
      return { ...primary, isSharedWeeklyContent: false };
    }
  } catch {
    primary = null;
  }

  try {
    const loaded = finalize(await loadWeeklyContentFromDatabase(ocId, teacherUserId));
    if (weeklyContentHasTopics(loaded)) {
      return { ...loaded, isSharedWeeklyContent: false, loadedFromDatabase: true };
    }
  } catch {
    // Continue to sibling sections.
  }

  let offeredList = [];
  try {
    const offered = await getOfferedCourses();
    offeredList = Array.isArray(offered) ? offered : [];
  } catch {
    return primary ?? { weeks: [], offeredCourseId: ocId };
  }

  const peers = findSameSubjectPeers(offeredList, ocId);
  for (const peer of peers) {
    const peerId = peer.offeredCourseId ?? peer.OfferedCourseId;
    if (peerId == null) continue;

    let peerData = null;
    try {
      peerData = finalize(await getWeeklyContent(peerId, teacherUserId));
    } catch {
      continue;
    }
    if (!weeklyContentHasTopics(peerData)) continue;

    try {
      const synced = finalize(await loadWeeklyContentFromDatabase(ocId, teacherUserId));
      if (weeklyContentHasTopics(synced)) {
        const peerSection = peer.sectionName ?? peer.SectionName ?? peerData?.sectionName ?? "";
        return {
          ...synced,
          isSharedWeeklyContent: true,
          sharedFromOfferedCourseId: peerId,
          sharedFromSectionName: peerSection,
        };
      }
    } catch {
      // Retry own section after server-side topic sync.
    }

    try {
      const ownWithProgress = finalize(await getWeeklyContent(ocId, teacherUserId));
      if (weeklyContentHasTopics(ownWithProgress)) {
        const peerSection = peer.sectionName ?? peer.SectionName ?? peerData?.sectionName ?? "";
        return {
          ...ownWithProgress,
          isSharedWeeklyContent: true,
          sharedFromOfferedCourseId: peerId,
          sharedFromSectionName: peerSection,
        };
      }
    } catch {
      // No local topics could be synced for this section yet.
    }
  }

  return primary ?? { weeks: [], offeredCourseId: ocId };
}

/** Mark hasWeeklyContent on all sections when any section of the same subject has content. */
export async function enrichCoursesWithSharedWeeklyContent(courses = [], { concurrency = 4 } = {}) {
  const list = Array.isArray(courses) ? courses.map((c) => ({ ...c })) : [];
  if (!list.length) return list;

  const groups = new Map();
  for (const course of list) {
    const key = subjectKeyForCourse(course);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(course);
  }

  const groupHasContent = new Map();
  for (const [key, members] of groups) {
    const anyHasFlag = members.some((c) => c.hasWeeklyContent ?? c.HasWeeklyContent);
    if (anyHasFlag) {
      groupHasContent.set(key, true);
      continue;
    }

    const sampleId = members[0]?.offeredCourseId ?? members[0]?.OfferedCourseId ?? null;
    if (sampleId == null) continue;

    try {
      const weekly = await getWeeklyContentShared(sampleId);
      groupHasContent.set(key, weeklyContentHasTopics(weekly));
    } catch {
      groupHasContent.set(key, false);
    }
  }

  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < list.length) {
      const index = nextIndex;
      nextIndex += 1;
      const course = list[index];
      const key = subjectKeyForCourse(course);
      if (!key || !groupHasContent.get(key)) continue;

      const ocId = course.offeredCourseId ?? course.OfferedCourseId;
      const hasBackendProgress =
        course.weeklyProgressPercentage != null || course.WeeklyProgressPercentage != null;

      const next = {
        ...course,
        hasWeeklyContent: true,
        HasWeeklyContent: true,
      };

      if (!hasBackendProgress && ocId != null) {
        try {
          const weekly = await getWeeklyContentShared(ocId);
          if (weeklyContentHasTopics(weekly)) {
            const stats = computeWeeklyProgressFromWeeks(weekly.weeks ?? []);
            next.weeklyProgressPercentage = stats.weeklyProgressPercentage;
            next.coveredTopics = stats.coveredTopics;
            next.totalTopics = stats.totalTopics;
            next.deviationTopics = stats.deviationTopics;
          }
        } catch {
          // Keep hasWeeklyContent flag without stats.
        }
      }

      list[index] = next;
    }
  };

  const workers = Math.min(concurrency, list.length || 1);
  await Promise.all(Array.from({ length: workers }, () => runWorker()));

  return list;
}

export async function addWeeklyTopic(offeredCourseId, payload) {
  return await request(`/TeacherWeeklyContent/${offeredCourseId}/topics`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTopicProgress(
  offeredCourseId,
  topicId,
  teacherUserId,
  isCompleted,
  alsoOfferedCourseIds = []
) {
  const extra = (alsoOfferedCourseIds || []).filter((id) => Number(id) > 0 && Number(id) !== Number(offeredCourseId));
  const result = await request(`/TeacherWeeklyContent/${offeredCourseId}/topics/${topicId}/complete`, {
    method: "PUT",
    body: JSON.stringify({
      teacherUserId,
      isCompleted,
      alsoOfferedCourseIds: extra,
    }),
  });
  return normalizeWeeklyContent({ ...result, offeredCourseId: Number(offeredCourseId) });
}

export async function uploadWeeklyContentFile(offeredCourseId, teacherUserId, file) {
  const formData = new FormData();
  formData.append("uploadedByUserId", String(teacherUserId));
  appendFormFile(formData, "file", file, "weekly-content.xlsx");

  return await request(`/TeacherWeeklyContent/${offeredCourseId}/upload`, {
    method: "POST",
    body: formData,
    timeoutMs: 90000,
  });
}

export async function getCourseFolderOverview(offeredCourseId) {
  return await request(`/TeacherSubmission/offered-course/${offeredCourseId}`);
}

export async function enrichCoursesWithFolderReview(courses, concurrency = 4) {
  const list = [...(courses || [])];
  if (list.length === 0) return list;

  let nextIndex = 0;
  const runWorker = async () => {
    while (nextIndex < list.length) {
      const index = nextIndex;
      nextIndex += 1;
      const course = list[index];
      const ocId = course.offeredCourseId ?? course.OfferedCourseId;
      if (ocId == null) continue;

      try {
        const overview = await getCourseFolderOverview(ocId);
        list[index] = {
          ...course,
          submissionStatus:
            overview.submissionStatus ??
            overview.SubmissionStatus ??
            course.submissionStatus ??
            course.SubmissionStatus,
          rejectionReason:
            overview.rejectionReason ?? overview.RejectionReason ?? course.rejectionReason,
          folderStatus: overview.folderStatus ?? overview.FolderStatus ?? course.folderStatus,
        };
      } catch {
        // Keep course row without review fields.
      }
    }
  };

  const workers = Math.min(concurrency, list.length);
  await Promise.all(Array.from({ length: workers }, () => runWorker()));
  return list;
}

export async function createMasterFolder(offeredCourseId, teacherUserId) {
  return await request(
    `/TeacherSubmission/offered-course/${offeredCourseId}/create-master-folder?teacherUserId=${teacherUserId}`,
    { method: "POST" }
  );
}

export async function createCustomFolder(offeredCourseId, teacherUserId, folderName) {
  return await request(`/TeacherSubmission/offered-course/${offeredCourseId}/custom-folders`, {
    method: "POST",
    body: JSON.stringify({ teacherUserId, folderName }),
  });
}

export async function downloadTeacherFile(fileId, offeredCourseId, fallbackFileName = "download") {
  const query =
    Number(fileId) < 0 && offeredCourseId
      ? `?offeredCourseId=${encodeURIComponent(offeredCourseId)}`
      : "";
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/TeacherSubmission/files/${fileId}/download${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    let message = "Could not download file.";
    try {
      const data = await response.json();
      message = data?.message || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const basicName = disposition.match(/filename=\"?([^\";]+)\"?/i)?.[1];
  const fileName = (
    encodedName ? decodeURIComponent(encodedName) : basicName || fallbackFileName
  )
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .trim();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function getFolderFiles(directoryId, offeredCourseId) {
  const query =
    offeredCourseId != null && offeredCourseId !== ""
      ? `?offeredCourseId=${encodeURIComponent(offeredCourseId)}`
      : "";
  return await request(`/TeacherSubmission/folders/${directoryId}/files${query}`);
}

export async function uploadFileToCourseFolder(
  directoryId,
  teacherUserId,
  fileCategory,
  file,
  offeredCourseId
) {
  const formData = new FormData();
  formData.append("uploadedByUserId", String(teacherUserId));
  formData.append("fileCategory", fileCategory);
  if (offeredCourseId != null && offeredCourseId !== "") {
    formData.append("offeredCourseId", String(offeredCourseId));
  }
  appendFormFile(formData, "file", file, "upload.bin");

  return await request(`/TeacherSubmission/folders/${directoryId}/upload`, {
    method: "POST",
    body: formData,
    timeoutMs: 60000,
  });
}

export async function deleteCourseFolderFile(fileId, offeredCourseId) {
  const query =
    offeredCourseId != null && offeredCourseId !== ""
      ? `?offeredCourseId=${encodeURIComponent(offeredCourseId)}`
      : "";
  return await request(`/TeacherSubmission/files/${fileId}${query}`, {
    method: "DELETE",
  });
}

export async function validateCourseFolder(offeredCourseId) {
  return await request(`/TeacherSubmission/offered-course/${offeredCourseId}/validate`, {
    method: "POST",
  });
}

export async function submitCourseFolder(offeredCourseId, teacherUserId) {
  return await request(
    `/TeacherSubmission/offered-course/${offeredCourseId}/submit?teacherUserId=${teacherUserId}`,
    { method: "POST", timeoutMs: 60000 }
  );
}

export async function importMainFolderDataToSubmittedFolder(offeredCourseId, teacherUserId) {
  return await request(
    `/TeacherSubmission/offered-course/${offeredCourseId}/import-main-data?teacherUserId=${encodeURIComponent(
      teacherUserId
    )}`,
    { method: "POST", timeoutMs: 90000 }
  );
}

/** Publishes approved CLO–Task mapping PDF into the master folder. */
export async function publishSectionToSubmittedFolder(offeredCourseId, teacherUserId, section) {
  return await request(
    `/TeacherSubmission/offered-course/${offeredCourseId}/publish-section?teacherUserId=${encodeURIComponent(
      teacherUserId
    )}&section=${encodeURIComponent(section)}`,
    { method: "POST", timeoutMs: 60000 }
  );
}

export async function publishCloTaskMappingToFolder(offeredCourseId, teacherUserId) {
  return await request(
    `/TeacherSubmission/offered-course/${offeredCourseId}/publish-clo-task-mapping?teacherUserId=${encodeURIComponent(
      teacherUserId
    )}`,
    { method: "POST", timeoutMs: 60000 }
  );
}

function topicRowKey(row) {
  const week = row.weekNo ?? "";
  const name = String(row.topicName ?? "")
    .trim()
    .toLowerCase();
  return `${week}|${name}`;
}

function teacherFromOfferedCourse(peer) {
  return {
    offeredCourseId: peer.offeredCourseId ?? peer.OfferedCourseId,
    teacherUserId: peer.teacherUserId ?? peer.TeacherUserId,
    teacherName: peer.teacherName ?? peer.TeacherName ?? "",
    sectionName: peer.sectionName ?? peer.SectionName ?? "",
    columnLabel: peer.columnLabel ?? peer.ColumnLabel ?? "",
  };
}

/** Merge sync data so Compare shows every section teaching the same subject (BAI + BCS, etc.). */
function mergeSyncAcrossSameSubject(primary, otherResults, offeredPeers, currentOfferedCourseId) {
  const teacherMap = new Map();

  for (const t of primary.teachers ?? []) {
    teacherMap.set(Number(t.offeredCourseId), t);
  }
  for (const result of otherResults) {
    for (const t of result?.teachers ?? []) {
      teacherMap.set(Number(t.offeredCourseId), t);
    }
  }
  for (const peer of offeredPeers) {
    const t = teacherFromOfferedCourse(peer);
    if (!teacherMap.has(Number(t.offeredCourseId))) {
      teacherMap.set(Number(t.offeredCourseId), t);
    }
  }

  const teachers = Array.from(teacherMap.values()).sort((a, b) =>
    String(a.sectionName).localeCompare(String(b.sectionName), undefined, { numeric: true })
  );

  const rowMap = new Map();
  const allResults = [primary, ...otherResults.filter(Boolean)];

  for (const result of allResults) {
    for (const row of result.matrix ?? []) {
      const key = topicRowKey(row);
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          topicId: row.topicId,
          weekNo: row.weekNo,
          topicName: row.topicName,
          statuses: [],
        });
      }
      const merged = rowMap.get(key);
      for (const status of row.statuses ?? []) {
        const ocId = Number(status.offeredCourseId);
        if (!merged.statuses.some((s) => Number(s.offeredCourseId) === ocId)) {
          merged.statuses.push(status);
        }
      }
    }
  }

  const matrix = Array.from(rowMap.values())
    .map((row) => {
      const statusByOc = new Map(row.statuses.map((s) => [Number(s.offeredCourseId), s]));
      const statuses = teachers.map((t) => {
        const ocId = Number(t.offeredCourseId);
        if (statusByOc.has(ocId)) return statusByOc.get(ocId);
        return {
          offeredCourseId: ocId,
          teacherUserId: t.teacherUserId,
          teacherName: t.teacherName,
          sectionName: t.sectionName,
          isCompleted: false,
        };
      });
      return { ...row, statuses };
    })
    .sort((a, b) => {
      const wa = Number(a.weekNo) || 0;
      const wb = Number(b.weekNo) || 0;
      if (wa !== wb) return wa - wb;
      return String(a.topicName).localeCompare(String(b.topicName));
    });

  return {
    ...primary,
    currentOfferedCourseId: Number(currentOfferedCourseId),
    teachers,
    matrix,
  };
}

export async function getTeacherSynchronization(offeredCourseId) {
  const primary = normalizeTeacherSynchronizationDto(
    await request(`/TeacherSynchronization/offered-course/${offeredCourseId}`)
  );

  try {
    const offered = await getOfferedCourses();
    const list = Array.isArray(offered) ? offered : [];
    const peers = findSameSubjectPeers(list, offeredCourseId);

    if (peers.length === 0) return primary;

    const otherResults = await Promise.all(
      peers.map(async (peer) => {
        const ocId = peer.offeredCourseId ?? peer.OfferedCourseId;
        try {
          const raw = await request(`/TeacherSynchronization/offered-course/${ocId}`);
          return normalizeTeacherSynchronizationDto(raw);
        } catch {
          return null;
        }
      })
    );

    return mergeSyncAcrossSameSubject(primary, otherResults, peers, offeredCourseId);
  } catch {
    return primary;
  }
}
