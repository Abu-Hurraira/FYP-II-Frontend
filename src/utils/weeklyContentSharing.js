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
    weeks: weeksFromWeeklyContent(data).map(normalizeTopicNode),
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

export function subjectKeyForCourse(course) {
  const courseId = courseIdFromRecord(course);
  if (courseId != null) return `id:${courseId}`;
  const title = courseTitleKey(course);
  return title ? `title:${title}` : null;
}
