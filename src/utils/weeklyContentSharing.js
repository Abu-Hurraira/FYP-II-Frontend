/** Weeks array from API (camelCase or PascalCase). */
export function weeksFromWeeklyContent(data) {
  const weeks = data?.weeks ?? data?.Weeks ?? [];
  return Array.isArray(weeks) ? weeks : [];
}

/** Whether weekly content response has any topic/week rows. */
export function weeklyContentHasTopics(data) {
  return weeksFromWeeklyContent(data).length > 0;
}

function normalizeTopicNode(topic) {
  if (!topic || typeof topic !== "object") return topic;
  const children = (topic.children ?? topic.Children ?? []).map(normalizeTopicNode);
  return {
    ...topic,
    topicId: topic.topicId ?? topic.TopicId,
    topicTitle: topic.topicTitle ?? topic.TopicTitle,
    weekNo: topic.weekNo ?? topic.WeekNo,
    isCompleted: Boolean(topic.isCompleted ?? topic.IsCompleted),
    children,
  };
}

/** Normalize weekly content API payload for the UI. */
export function normalizeWeeklyContent(data) {
  if (!data || typeof data !== "object") return data;
  return {
    ...data,
    offeredCourseId: data.offeredCourseId ?? data.OfferedCourseId,
    programCourseId: data.programCourseId ?? data.ProgramCourseId,
    courseTitle: data.courseTitle ?? data.CourseTitle,
    sectionName: data.sectionName ?? data.SectionName,
    teacherName: data.teacherName ?? data.TeacherName,
    contentStatuses: data.contentStatuses ?? data.ContentStatuses ?? [],
    weeks: weeksFromWeeklyContent(data).map(normalizeTopicNode),
    siblingSections: (data.siblingSections ?? data.SiblingSections ?? []).map((s) => ({
      offeredCourseId: s.offeredCourseId ?? s.OfferedCourseId,
      sectionName: s.sectionName ?? s.SectionName ?? "",
      programCode: s.programCode ?? s.ProgramCode ?? "",
      programName: s.programName ?? s.ProgramName ?? "",
    })),
  };
}

/** Clear completion flags so shared outline does not leak another section's progress. */
export function stripTopicCompletionFromWeeks(weeks = []) {
  return weeks.map(stripTopicCompletionFromTopic);
}

function stripTopicCompletionFromTopic(topic) {
  const children = (topic.children ?? topic.Children ?? []).map(stripTopicCompletionFromTopic);
  return {
    ...topic,
    isCompleted: false,
    IsCompleted: false,
    children,
  };
}

export function offeredCourseIdFromRecord(record) {
  return Number(record?.offeredCourseId ?? record?.OfferedCourseId);
}

export function courseIdFromRecord(record) {
  const id = record?.courseId ?? record?.CourseId;
  return id != null && id !== "" ? Number(id) : null;
}

export function courseTitleKey(record) {
  return String(record?.courseTitle ?? record?.CourseTitle ?? "")
    .trim()
    .toLowerCase();
}

/** Other offered-course rows for the same subject (e.g. all Applied Physics sections). */
export function findSameSubjectPeers(offeredList, offeredCourseId) {
  const list = Array.isArray(offeredList) ? offeredList : [];
  const current = list.find(
    (oc) => offeredCourseIdFromRecord(oc) === Number(offeredCourseId)
  );
  if (!current) return [];

  const courseId = courseIdFromRecord(current);
  const courseTitle = courseTitleKey(current);

  return list.filter((oc) => {
    const ocId = offeredCourseIdFromRecord(oc);
    if (ocId === Number(offeredCourseId)) return false;
    if (courseId != null) {
      return courseIdFromRecord(oc) === courseId;
    }
    if (courseTitle) {
      return courseTitleKey(oc) === courseTitle;
    }
    return false;
  });
}

export function groupOfferedCoursesBySubject(offeredList) {
  const groups = new Map();
  for (const row of offeredList || []) {
    const courseId = courseIdFromRecord(row);
    const key =
      courseId != null ? `id:${courseId}` : `title:${courseTitleKey(row)}`;
    if (!key.endsWith(":") && key !== "title:") {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
  }
  return groups;
}

/** Other sections of the same subject assigned to this teacher. */
export function findTeacherSiblingSections(courses, offeredCourseId) {
  const list = Array.isArray(courses) ? courses : [];
  const current = list.find((c) => Number(c.offeredCourseId) === Number(offeredCourseId));
  if (!current) return [];

  const courseId = Number(current.courseId) || 0;
  const title = String(current.courseTitle || "").trim().toLowerCase();

  return list
    .filter((c) => {
      if (Number(c.offeredCourseId) === Number(offeredCourseId)) return false;
      if (courseId && Number(c.courseId) === courseId) return true;
      return Boolean(title && String(c.courseTitle || "").trim().toLowerCase() === title);
    })
    .map((c) => ({
      offeredCourseId: Number(c.offeredCourseId),
      sectionName: c.sectionName || "",
      programCode: c.programCode || "",
      programName: c.programName || "",
    }));
}

export function subjectKeyForCourse(course) {
  const courseId = courseIdFromRecord(course);
  if (courseId != null) return `id:${courseId}`;
  const title = courseTitleKey(course);
  return title ? `title:${title}` : null;
}
