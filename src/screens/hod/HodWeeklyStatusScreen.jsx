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

const WEEK_PALETTES = [
  {
    badgeBg: "bg-emerald-950/80 border-emerald-500/30 text-emerald-400",
    visibleBadge: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    btnStyle: "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10",
    iconPath: "M12 11c0 3.5-3.5 6-3.5 6S5 14.5 5 11a7 7 0 1114 0c0 3.5-3.5 6-3.5 6S12 14.5 12 11z",
  },
  {
    badgeBg: "bg-yellow-950/80 border-yellow-500/30 text-yellow-400",
    visibleBadge: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
    btnStyle: "border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10",
    iconPath: "M8 7h8m0 0l-4-4m4 4l-4 4m0 6H8m0 0l4 4m-4-4l4-4",
  },
  {
    badgeBg: "bg-amber-950/80 border-amber-500/30 text-amber-400",
    visibleBadge: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    btnStyle: "border-amber-500/40 text-amber-400 hover:bg-amber-500/10",
    iconPath: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  {
    badgeBg: "bg-purple-950/80 border-purple-500/30 text-purple-400",
    visibleBadge: "bg-purple-500/15 text-purple-400 border border-purple-500/30",
    btnStyle: "border-purple-500/40 text-purple-400 hover:bg-purple-500/10",
    iconPath: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 3a7 7 0 110 14 7 7 0 010-14z",
  },
  {
    badgeBg: "bg-blue-950/80 border-blue-500/30 text-blue-400",
    visibleBadge: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    btnStyle: "border-blue-500/40 text-blue-400 hover:bg-blue-500/10",
    iconPath: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  {
    badgeBg: "bg-cyan-950/80 border-cyan-500/30 text-cyan-400",
    badgeText: "text-cyan-400",
    visibleBadge: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30",
    btnStyle: "border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10",
    iconPath: "M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 7h10v10H7z",
  },
  {
    badgeBg: "bg-pink-950/80 border-pink-500/30 text-pink-400",
    visibleBadge: "bg-pink-500/15 text-pink-400 border border-pink-500/30",
    btnStyle: "border-pink-500/40 text-pink-400 hover:bg-pink-500/10",
    iconPath: "M3 12h3l2-6 4 12 3-9 2 5h4",
  },
  {
    badgeBg: "bg-lime-950/80 border-lime-500/30 text-lime-400",
    visibleBadge: "bg-lime-500/15 text-lime-400 border border-lime-500/30",
    btnStyle: "border-lime-500/40 text-lime-400 hover:bg-lime-500/10",
    iconPath: "M12 2.25c-5.3 0-8.25 4.5-8.25 10.5 0 2.25 1.5 4.5 3 6l2.25-2.25v-3h6v3l2.25 2.25c1.5-1.5 3-3.75 3-6 0-6-2.95-10.5-8.25-10.5z",
  },
];

function getTopicCoverageDetails(topic) {
  const children = topic.children ?? [];
  if (children.length === 0) {
    const isDone = Boolean(topic.isCompleted);
    return {
      status: isDone ? "complete" : "pending",
      label: isDone ? "Complete" : "Not Complete",
      doneCount: isDone ? 1 : 0,
      totalCount: 1,
    };
  }

  let doneCount = 0;
  let totalCount = 0;

  function countLeaves(t) {
    const subs = t.children ?? [];
    if (subs.length === 0) {
      totalCount++;
      if (t.isCompleted) doneCount++;
    } else {
      for (const s of subs) {
        countLeaves(s);
      }
    }
  }

  countLeaves(topic);

  let status = "pending";
  let label = "Not Complete";

  if (doneCount === totalCount && totalCount > 0) {
    status = "complete";
    label = "Complete";
  } else if (doneCount > 0) {
    status = "partial";
    label = `Partial (${doneCount}/${totalCount})`;
  } else {
    status = "pending";
    label = "Not Complete";
  }

  return { status, label, doneCount, totalCount };
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
      <div className="border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8 dark:border-[#1b2c2e] dark:bg-[#071113]">
        <div className="flex flex-wrap items-start gap-3">
          <PageBackButton className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Weekly Topic Status</h1>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
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
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          {weeks.length === 0 ? (
            <p className="py-16 text-center text-gray-500">No weekly content uploaded yet.</p>
          ) : (
            <div className="flex flex-col gap-3.5">
              {weeks.map((week, index) => {
                const expanded = expandedWeekId === week.topicId;
                const weekNo = week.weekNo != null ? Number(week.weekNo) : index + 1;
                const subTopicCount = week.children?.length ?? 0;
                const coverage = getTopicCoverageDetails(week);
                const palette = WEEK_PALETTES[index % WEEK_PALETTES.length];

                return (
                  <div
                    key={week.topicId}
                    className="rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm transition-all dark:border-[#1b2c2e] dark:bg-[#0c181a] dark:hover:border-[#274347]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3.5">
                      {/* Left Badge: 01 + Icon */}
                      <div className={`flex h-12 w-24 shrink-0 items-center justify-between rounded-xl border px-3 shadow-xs ${palette.badgeBg}`}>
                        <span className="text-base font-extrabold tracking-tight">
                          {String(weekNo).padStart(2, "0")}
                        </span>
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={palette.iconPath} />
                        </svg>
                      </div>

                      {/* Middle Topic Title & Details */}
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => setExpandedWeekId(expanded ? null : week.topicId)}
                          className="line-clamp-1 text-left text-sm font-bold text-gray-900 transition hover:text-emerald-500 dark:text-white dark:hover:text-emerald-400"
                        >
                          Week #{String(weekNo).padStart(2, "0")} — {week.topicTitle}
                        </button>
                        <div className="mt-1 flex flex-wrap items-center gap-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1.5">
                            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {subTopicCount} sub-topics
                          </span>
                          <span className="flex items-center gap-1.5">
                            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Last updated: 12 May 2024
                          </span>
                        </div>
                      </div>

                      {/* Right Status & Chevron */}
                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                        {/* Coverage Ratio Badge (e.g. 2/4) */}
                        <div
                          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold border ${
                            coverage.status === "complete"
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                              : coverage.status === "partial"
                                ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                                : "bg-rose-500/20 text-rose-400 border-rose-500/40"
                          }`}
                          title={`${coverage.doneCount} of ${coverage.totalCount} completed`}
                        >
                          <span>{coverage.doneCount}/{coverage.totalCount}</span>
                        </div>

                        {/* Hidden sub-topics hint */}
                        {!expanded && subTopicCount > 0 && (
                          <div className="hidden text-right text-xs text-gray-500 dark:text-gray-400 lg:block">
                            <div>{subTopicCount} sub-topics hidden</div>
                            <div className="text-[10px] text-gray-400 dark:text-gray-500">Tap the week title or &gt; to expand</div>
                          </div>
                        )}

                        {/* Chevron expand button */}
                        <button
                          type="button"
                          onClick={() => setExpandedWeekId(expanded ? null : week.topicId)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
                          aria-expanded={expanded}
                        >
                          <span className={`inline-block transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}>
                            &gt;
                          </span>
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-3.5 rounded-xl border border-gray-200 bg-gray-50/70 p-3 shadow-inner dark:border-[#1b2c2e] dark:bg-[#071113]">
                        {(week.children?.length ?? 0) > 0 ? (
                          <div className="space-y-2">
                            {week.children.map((child) => (
                              <TopicReadOnly key={child.topicId} topic={child} level={0} />
                            ))}
                          </div>
                        ) : (
                          <p className="px-4 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                            {isTopicFullyCovered(week) ? "Week marked complete." : "Week not yet complete."}
                          </p>
                        )}
                      </div>
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
  const pad = level * 16;

  return (
    <div style={{ paddingLeft: pad }} className="mb-2 last:mb-0">
      <button
        type="button"
        onClick={() => hasChildren && setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 rounded-xl border border-gray-200/80 bg-white/90 px-3.5 py-2.5 text-left text-sm transition dark:border-[#1b2c2e] dark:bg-[#122225] dark:hover:bg-[#172d31]"
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs ${
            done ? "bg-emerald-500" : "bg-rose-500"
          }`}
        >
          {done ? "✓" : "×"}
        </span>
        <span className="min-w-0 flex-1 font-semibold text-gray-900 dark:text-gray-100">
          {topic.topicTitle}
        </span>
        {hasChildren && (
          <span className={`text-gray-400 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}>
            ›
          </span>
        )}
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {topic.children.map((child) => (
            <TopicReadOnly key={child.topicId} topic={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
