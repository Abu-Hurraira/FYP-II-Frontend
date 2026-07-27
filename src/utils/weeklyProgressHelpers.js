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
  if (status === "complete") return "week-card week-card--complete";
  if (status === "in-progress") return "week-card week-card--progress";
  return "week-card week-card--pending";
}

export function progressBarColor(percentage) {
  if (percentage >= 80) return "#22c55e";
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
  const nested =
    record?.folderSubmission ??
    record?.FolderSubmission ??
    record?.submission ??
    record?.Submission ??
    null;

  return String(
    record?.hodReviewStatus ??
      record?.HodReviewStatus ??
      record?.reviewStatus ??
      record?.ReviewStatus ??
      record?.submissionReviewStatus ??
      record?.SubmissionReviewStatus ??
      record?.submissionStatus ??
      record?.SubmissionStatus ??
      nested?.submissionStatus ??
      nested?.SubmissionStatus ??
      nested?.reviewStatus ??
      nested?.ReviewStatus ??
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
    record?.folderStatus ?? record?.FolderStatus ?? record?.submissionStatus ?? record?.SubmissionStatus ?? ""
  ).toLowerCase();
  const review = folderReviewStatusFromRecord(record).toLowerCase();
  return locked || status === "submitted" || status === "approved" || review === "approved";
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
      return "bg-green-100 text-green-800";
    case "Rejected":
      return "bg-red-100 text-red-800";
    case "Submitted":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-green-100 text-green-800";
  }
}

/** Course folder is read-only while awaiting or after HOD approval. */
export function isSubmitFolderLocked(status) {
  return status === "Submitted" || status === "Approved";
}

/** Prefer the most restrictive status from multiple API/navigation sources. */
export function resolveTeacherFolderStatus(...sources) {
  const statuses = sources
    .filter((source) => source != null && source !== "")
    .map((source) => (typeof source === "string" ? source : teacherFolderSubmissionStatus(source)));

  if (statuses.includes("Approved")) return "Approved";
  if (statuses.includes("Submitted")) return "Submitted";
  if (statuses.includes("Rejected")) return "Rejected";
  return "In Progress";
}
