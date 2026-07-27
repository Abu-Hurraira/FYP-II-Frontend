import request from "./apiClient";
import { getOfferedCourses } from "./offeredCoursesApi";
import { appendFormFile } from "../utils/appendFormFile";
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

export async function getTeacherCourses(teacherUserId) {
  return await request(`/TeacherDashboard/${teacherUserId}/courses`);
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
  const [dashboard, submission] = await Promise.all([
    getTeacherCourses(teacherUserId).catch(() => []),
    getTeacherSubmissionCourses(teacherUserId).catch(() => []),
  ]);
  return mergeTeacherCourses(
    Array.isArray(dashboard) ? dashboard : [],
    Array.isArray(submission) ? submission : []
  );
}

export async function getCourseMenu(offeredCourseId) {
  const raw = await request(`/TeacherDashboard/course-menu/${offeredCourseId}`);
  return {
    offeredCourseId: raw.offeredCourseId ?? raw.OfferedCourseId,
    courseId: raw.courseId ?? raw.CourseId,
    programCourseId: raw.programCourseId ?? raw.ProgramCourseId,
    courseTitle: raw.courseTitle ?? raw.CourseTitle ?? "",
    courseCode: raw.courseCode ?? raw.CourseCode ?? "",
    sectionName: raw.sectionName ?? raw.SectionName ?? "",
    teacherName: raw.teacherName ?? raw.TeacherName ?? "",
  };
}

export async function getWeeklyContent(offeredCourseId) {
  return await request(`/TeacherWeeklyContent/${offeredCourseId}`);
}

export async function loadWeeklyContentFromDatabase(offeredCourseId) {
  return await request(`/TeacherWeeklyContent/${offeredCourseId}/load-from-database`, {
    method: "POST",
  });
}

/**
 * Weekly content is uploaded per section but should be visible to every teacher
 * teaching the same subject. Tries own section, DB sync, then sibling sections.
 * Progress always comes from the requested section — never from a peer section.
 */
export async function getWeeklyContentShared(offeredCourseId) {
  const ocId = Number(offeredCourseId);

  const finalize = (data, extra = {}) =>
    normalizeWeeklyContent({ ...data, offeredCourseId: ocId, ...extra });

  let primary = null;
  try {
    primary = finalize(await getWeeklyContent(ocId));
    if (weeklyContentHasTopics(primary)) {
      return { ...primary, isSharedWeeklyContent: false };
    }
  } catch {
    primary = null;
  }

  try {
    const loaded = finalize(await loadWeeklyContentFromDatabase(ocId));
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
      peerData = finalize(await getWeeklyContent(peerId));
    } catch {
      continue;
    }
    if (!weeklyContentHasTopics(peerData)) continue;

    try {
      const synced = finalize(await loadWeeklyContentFromDatabase(ocId));
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
      const ownWithProgress = finalize(await getWeeklyContent(ocId));
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

export async function updateTopicProgress(offeredCourseId, topicId, teacherUserId, isCompleted) {
  const result = await request(`/TeacherWeeklyContent/${offeredCourseId}/topics/${topicId}/complete`, {
    method: "PUT",
    body: JSON.stringify({ teacherUserId, isCompleted }),
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
    timeoutMs: 60000,
  });
}

export async function getTeacherSubmissionCourses(teacherUserId) {
  return await request(`/TeacherSubmission/teacher/${teacherUserId}/courses`);
}

/** Attach folder lock + HOD review fields from each course overview. */
export async function enrichCoursesWithFolderReview(courses = [], { concurrency = 4 } = {}) {
  const list = Array.isArray(courses) ? [...courses] : [];
  if (!list.length) return [];

  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < list.length) {
      const index = nextIndex;
      nextIndex += 1;
      const course = list[index];
      const offeredCourseId = course.offeredCourseId ?? course.OfferedCourseId;
      if (!offeredCourseId) continue;

      try {
        const overview = await getCourseFolderOverview(offeredCourseId);
        list[index] = {
          ...course,
          isLocked: overview.isLocked ?? overview.IsLocked ?? course.isLocked,
          reviewStatus:
            overview.reviewStatus ??
            overview.ReviewStatus ??
            overview.submissionReviewStatus ??
            overview.SubmissionReviewStatus ??
            overview.hodReviewStatus ??
            overview.HodReviewStatus ??
            overview.submissionStatus ??
            overview.SubmissionStatus ??
            course.reviewStatus ??
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

export async function getCourseFolderOverview(offeredCourseId) {
  return await request(`/TeacherSubmission/offered-course/${offeredCourseId}`);
}

export async function createMasterFolder(offeredCourseId, teacherUserId) {
  return await request(
    `/TeacherSubmission/offered-course/${offeredCourseId}/create-master-folder?teacherUserId=${teacherUserId}`,
    { method: "POST" }
  );
}

export async function getFolderFiles(directoryId) {
  return await request(`/TeacherSubmission/folders/${directoryId}/files`);
}

export async function uploadFileToCourseFolder(directoryId, teacherUserId, fileCategory, file) {
  const formData = new FormData();
  formData.append("uploadedByUserId", String(teacherUserId));
  formData.append("fileCategory", fileCategory);
  appendFormFile(formData, "file", file, "upload.bin");

  return await request(`/TeacherSubmission/folders/${directoryId}/upload`, {
    method: "POST",
    body: formData,
    timeoutMs: 60000,
  });
}

export async function deleteCourseFolderFile(fileId) {
  return await request(`/TeacherSubmission/files/${fileId}`, {
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
