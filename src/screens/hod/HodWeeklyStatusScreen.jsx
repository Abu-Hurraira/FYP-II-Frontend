import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getWeeklyContentShared } from "../../api/teacherApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import theme from "../../styles/theme";
import { showAlert } from "../../utils/dialogs";
import {
  isTopicFullyCovered,
  weekCardClass,
  weekCardStatus,
} from "../../utils/weeklyProgressHelpers";

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
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
          {weeks.length === 0 ? (
            <p className="py-16 text-center text-gray-500">No weekly content uploaded yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {weeks.map((week, index) => {
                const status = weekCardStatus(week, index);
                const expanded = expandedWeekId === week.topicId;

                return (
                  <div
                    key={week.topicId}
                    className={`rounded-xl border p-4 shadow-sm ${weekCardClass(status)}`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedWeekId(expanded ? null : week.topicId)}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <span className="min-w-0 flex-1 text-sm font-semibold text-gray-900">
                        Week #{String(week.weekNo || "").padStart(2, "0")} — {week.topicTitle}
                      </span>
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-lg text-gray-700 shadow-sm transition ${expanded ? "rotate-90" : ""}`}
                        aria-hidden
                      >
                        ›
                      </span>
                    </button>

                    {expanded && (week.children?.length ?? 0) > 0 && (
                      <div className="mt-3 space-y-2 border-t border-black/5 pt-3">
                        {week.children.map((child) => (
                          <TopicReadOnly key={child.topicId} topic={child} level={0} />
                        ))}
                      </div>
                    )}

                    {expanded && !(week.children?.length > 0) && (
                      <p className="mt-3 border-t border-black/5 pt-3 text-xs text-gray-600">
                        {isTopicFullyCovered(week) ? "Week marked complete." : "Week not yet complete."}
                      </p>
                    )}
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
  const pad = 12 + level * 16;

  return (
    <div style={{ paddingLeft: pad }}>
      <button
        type="button"
        onClick={() => hasChildren && setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-left text-sm"
      >
        <span
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs text-white ${done ? "bg-emerald-500" : "bg-red-500"}`}
        >
          {done ? "✓" : "×"}
        </span>
        <span className="min-w-0 flex-1 font-medium text-gray-800">{topic.topicTitle}</span>
        {hasChildren && (
          <span className={`text-gray-500 transition ${expanded ? "rotate-90" : ""}`}>›</span>
        )}
      </button>
      {expanded &&
        topic.children.map((child) => (
          <TopicReadOnly key={child.topicId} topic={child} level={level + 1} />
        ))}
    </div>
  );
}
