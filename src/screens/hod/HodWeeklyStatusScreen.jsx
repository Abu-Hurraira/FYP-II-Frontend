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
  const [expandedWeekId, setExpandedWeekId] = useState(null);

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
        <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
          {weeks.length === 0 ? (
            <p className="py-16 text-center text-gray-500">No weekly content uploaded yet.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              {weeks.map((week, index) => {
                const expanded = expandedWeekId === week.topicId;
                const weekNo = week.weekNo != null ? Number(week.weekNo) : index + 1;
                const subTopicCount = week.children?.length ?? 0;
                const coverage = getTopicCoverageDetails(week);

                return (
                  <div key={week.topicId} className="border-b border-gray-200 last:border-b-0">
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => setExpandedWeekId(expanded ? null : week.topicId)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="text-sm font-semibold text-gray-900">
                          Week {String(weekNo).padStart(2, "0")} — {week.topicTitle}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {subTopicCount} sub-topic{subTopicCount === 1 ? "" : "s"} · {coverage.label}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedWeekId(expanded ? null : week.topicId)}
                        className="px-1 text-gray-400 hover:text-gray-700"
                        aria-expanded={expanded}
                      >
                        <span className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}>›</span>
                      </button>
                    </div>

                    {expanded ? (
                      <div className="border-t border-gray-100 bg-gray-50/60">
                        {(week.children?.length ?? 0) > 0 ? (
                          week.children.map((child) => (
                            <TopicReadOnly key={child.topicId} topic={child} level={0} />
                          ))
                        ) : (
                          <p className="px-4 py-3 text-sm text-gray-500">
                            {isTopicFullyCovered(week) ? "Week marked complete." : "Week not yet complete."}
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
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
  const pad = 16 + level * 18;

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
