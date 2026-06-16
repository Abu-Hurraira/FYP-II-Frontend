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
  const locked =
    course?.isFolderLocked ??
    course?.isLocked ??
    course?.folderSubmitted ??
    course?.isSubmitted ??
    false;
  const status = course?.folderStatus ?? course?.submissionStatus ?? "";
  if (locked || status === "Submitted") return "Submitted";
  return "Open";
}
