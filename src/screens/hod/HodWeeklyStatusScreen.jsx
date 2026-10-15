import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getWeeklyContentShared } from "../../api/teacherApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import theme from "../../styles/theme";
import { showAlert } from "../../utils/dialogs";
import { isTopicFullyCovered } from "../../utils/weeklyProgressHelpers";

function getTopicCoverageDetails(topic) {
  const children = topic.children ?? [];
  if (children.length === 0) {
    const isDone = Boolean(topic.isCompleted);
    return {
      status: isDone ? "complete" : "pending",
      label: isDone ? "Complete" : "Not complete",
      doneCount: isDone ? 1 : 0,
      totalCount: 1,
    };
  }

  let doneCount = 0;
  let totalCount = 0;

  function countLeaves(t) {
    const subs = t.children ?? [];
    if (subs.length === 0) {
      totalCount += 1;
      if (t.isCompleted) doneCount += 1;
    } else {
      for (const s of subs) countLeaves(s);
    }
  }

  countLeaves(topic);

  if (doneCount === totalCount && totalCount > 0) {
    return { status: "complete", label: "Complete", doneCount, totalCount };
  }
  if (doneCount > 0) {
    return {
      status: "partial",
      label: `Partial (${doneCount}/${totalCount})`,
      doneCount,
      totalCount,
    };
  }
  return { status: "pending", label: "Not complete", doneCount, totalCount };
}

export default function HodWeeklyStatusScreen() {
  const { offeredCourseId: oc } = useParams();
  const offeredCourseId = Number(oc);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const result = await getWeeklyContentShared(offeredCourseId);
        setData(result);
      } catch (error) {
        showAlert("Error", error.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [offeredCourseId]);

  const weeks = data?.weeks ?? [];
  const weekGroups = (() => {
    const map = new Map();
    for (const topic of weeks) {
      const weekNo = topic.weekNo != null ? Number(topic.weekNo) : 0;
      if (!map.has(weekNo)) map.set(weekNo, []);
      map.get(weekNo).push(topic);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([weekNo, topics]) => ({ weekNo, topics }));
  })();

  const toggleWeek = (weekNo) => {
    setExpandedWeeks((prev) => ({
      ...prev,
      [weekNo]: !(prev[weekNo] ?? true),
    }));
  };

  return (
    <div className="relative min-h-full bg-page pb-24">
      <div className="border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start gap-3">
          <PageBackButton className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-gray-900">Weekly Topic Status</h1>
            <p className="mt-0.5 text-xs text-gray-500">
              {data?.courseTitle || "Course"}
              {data?.sectionName ? ` · ${data.sectionName}` : ""}
              {data?.teacherName ? ` · ${data.teacherName}` : ""}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div
            className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
            style={{ borderTopColor: theme.colors.primary }}
          />
        </div>
      ) : (
        <div className="w-full space-y-4 px-4 py-4 sm:px-6 lg:px-8">
          {weekGroups.length === 0 ? (
            <p className="py-16 text-center text-gray-500">No weekly content uploaded yet.</p>
          ) : (
            weekGroups.map(({ weekNo, topics }) => {
              const expanded = expandedWeeks[weekNo] ?? false;
              const label = weekNo > 0 ? `Week ${String(weekNo).padStart(2, "0")}` : "Other topics";
              let doneCount = 0;
              let totalCount = 0;
              for (const topic of topics) {
                const details = getTopicCoverageDetails(topic);
                doneCount += details.doneCount;
                totalCount += details.totalCount;
              }
              const weekStatus =
                totalCount > 0 && doneCount === totalCount
                  ? "complete"
                  : doneCount > 0
                    ? "partial"
                    : "pending";
              const weekLabel =
                weekStatus === "complete"
                  ? "Complete"
                  : weekStatus === "partial"
                    ? `Partial (${doneCount}/${totalCount})`
                    : "Not complete";
              const headerTone =
                weekStatus === "complete"
                  ? "border-emerald-200 bg-emerald-50"
                  : weekStatus === "partial"
                    ? "border-amber-200 bg-amber-50"
                    : "border-gray-200 bg-slate-50";
              const statusTone =
                weekStatus === "complete"
                  ? "text-emerald-700"
                  : weekStatus === "partial"
                    ? "text-amber-700"
                    : "text-gray-500";
              return (
                <div
                  key={`week-${weekNo}`}
                  className={`overflow-hidden rounded-xl border bg-white ${
                    weekStatus === "complete"
                      ? "border-emerald-200"
                      : weekStatus === "partial"
                        ? "border-amber-200"
                        : "border-gray-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleWeek(weekNo)}
                    className={`flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-left ${headerTone}`}
                  >
                    <div>
                      <p className="text-sm font-extrabold text-gray-900">{label}</p>
                      <p className={`mt-0.5 text-xs font-semibold ${statusTone}`}>
                        {topics.length} topic{topics.length === 1 ? "" : "s"} · {weekLabel}
                      </p>
                    </div>
                    <span className={`inline-block text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}>
                      ›
                    </span>
                  </button>
                  {expanded
                    ? topics.map((topic) => {
                        const topicExpanded = expandedWeeks[`t-${topic.topicId}`] ?? false;
                        const subTopicCount = topic.children?.length ?? 0;
                        const coverage = getTopicCoverageDetails(topic);
                        return (
                          <div key={topic.topicId} className="border-b border-gray-200 last:border-b-0">
                            <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedWeeks((prev) => ({
                                    ...prev,
                                    [`t-${topic.topicId}`]: !topicExpanded,
                                  }))
                                }
                                className="min-w-0 flex-1 text-left"
                              >
                                <p className="text-sm font-semibold text-gray-900">{topic.topicTitle}</p>
                                <p className="mt-0.5 text-xs text-gray-500">
                                  {subTopicCount} sub-topic{subTopicCount === 1 ? "" : "s"} · {coverage.label}
                                </p>
                              </button>
                              {(topic.children?.length ?? 0) > 0 || isTopicFullyCovered(topic) ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedWeeks((prev) => ({
                                      ...prev,
                                      [`t-${topic.topicId}`]: !topicExpanded,
                                    }))
                                  }
                                  className="px-1 text-gray-400 hover:text-gray-700"
                                  aria-expanded={topicExpanded}
                                >
                                  <span
                                    className={`inline-block transition-transform ${topicExpanded ? "rotate-90" : ""}`}
                                  >
                                    ›
                                  </span>
                                </button>
                              ) : null}
                            </div>
                            {topicExpanded ? (
                              <div className="border-t border-gray-100 bg-gray-50/60 pl-6 sm:pl-8">
                                {(topic.children?.length ?? 0) > 0 ? (
                                  <div className="ml-2 border-l-2 border-emerald-200/80">
                                    {topic.children.map((child) => (
                                      <TopicReadOnly key={child.topicId} topic={child} level={0} />
                                    ))}
                                  </div>
                                ) : (
                                  <p className="px-4 py-3 text-sm text-gray-500">
                                    {isTopicFullyCovered(topic)
                                      ? "Topic marked complete."
                                      : "Topic not yet complete."}
                                  </p>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    : null}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function TopicReadOnly({ topic, level }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = (topic.children?.length ?? 0) > 0;
  const done = isTopicFullyCovered(topic);
  const pad = 20 + level * 22;

  return (
    <div>
      <button
        type="button"
        onClick={() => hasChildren && setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 border-b border-gray-100 py-2.5 pr-4 text-left last:border-b-0"
        style={{ paddingLeft: pad }}
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
            done ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-300 bg-white text-transparent"
          }`}
        >
          ✓
        </span>
        <span className="min-w-0 flex-1 text-sm text-gray-900">{topic.topicTitle}</span>
        {hasChildren ? (
          <span className={`text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}>›</span>
        ) : null}
      </button>
      {expanded
        ? topic.children.map((child) => (
            <TopicReadOnly key={child.topicId} topic={child} level={level + 1} />
          ))
        : null}
    </div>
  );
}
