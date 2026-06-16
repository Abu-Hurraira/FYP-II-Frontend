/** Leaf topics use their own flag; parents are covered only when every nested child is covered. */
export function isTopicFullyCovered(topic) {
  const children = topic.children ?? [];
  if (children.length === 0) {
    return Boolean(topic.isCompleted);
  }
  return children.every((child) => isTopicFullyCovered(child));
}

function collectLeafTopics(topic, out = []) {
  const children = topic.children ?? [];
  if (children.length === 0) {
    out.push(topic);
    return out;
  }
  for (const child of children) {
    collectLeafTopics(child, out);
  }
  return out;
}

/** Stats from TeacherWeeklyContent weeks array. */
export function computeWeeklyProgressFromWeeks(weeks = []) {
  const leaves = [];
  for (const week of weeks) {
    collectLeafTopics(week, leaves);
  }

  const totalTopics = leaves.length;
  const coveredTopics = leaves.filter((t) => isTopicFullyCovered(t)).length;
  const deviationTopics = Math.max(0, totalTopics - coveredTopics);
  const weeklyProgressPercentage =
    totalTopics > 0 ? Math.round((coveredTopics / totalTopics) * 100) : 0;

  return {
    totalTopics,
    coveredTopics,
    deviationTopics,
    weeklyProgressPercentage,
    hasWeeklyContent: totalTopics > 0,
  };
}

export function weekCardStatus(topic, weekIndex = 0) {
  if (isTopicFullyCovered(topic)) return "complete";
  if (weekIndex <= 2) return "in-progress";
  return "pending";
}

export function weekCardClass(status) {
  if (status === "complete") return "bg-emerald-100 border-emerald-200";
  if (status === "in-progress") return "bg-amber-100 border-amber-200";
  return "bg-red-50 border-red-200";
}

export function progressBarColor(percentage) {
  if (percentage >= 80) return "#1a8754";
  return "#DC2626";
}

export function folderStatusLabel(course) {
  const status = teacherFolderSubmissionStatus(course);
  if (status === "In Progress") return "Open";
  return status;
}

export function isSubmittedFolder(course) {
  const status = teacherFolderSubmissionStatus(course);
  return status === "Submitted" || status === "Approved";
}

export function folderReviewStatusFromRecord(record) {
  return String(
    record?.hodReviewStatus ??
      record?.HodReviewStatus ??
      record?.reviewStatus ??
      record?.ReviewStatus ??
      record?.submissionReviewStatus ??
      record?.SubmissionReviewStatus ??
      ""
  ).trim();
}

export function isFolderLockedRecord(record) {
  const locked = Boolean(
    record?.isFolderLocked ??
      record?.isLocked ??
      record?.IsLocked ??
      record?.folderSubmitted ??
      record?.isSubmitted ??
      false
  );
  const status = String(
    record?.folderStatus ?? record?.FolderStatus ?? record?.submissionStatus ?? ""
  ).toLowerCase();
  return locked || status === "submitted";
}

/** Teacher-facing folder submission status for list badges and banners. */
export function teacherFolderSubmissionStatus(record) {
  const review = folderReviewStatusFromRecord(record).toLowerCase();
  if (review === "approved") return "Approved";
  if (review === "rejected") return "Rejected";
  if (isFolderLockedRecord(record)) return "Submitted";
  return "In Progress";
}

export function teacherFolderStatusBadgeClass(status) {
  switch (status) {
    case "Approved":
      return "bg-emerald-100 text-emerald-800";
    case "Rejected":
      return "bg-red-100 text-red-800";
    case "Submitted":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-amber-100 text-amber-900";
  }
}
