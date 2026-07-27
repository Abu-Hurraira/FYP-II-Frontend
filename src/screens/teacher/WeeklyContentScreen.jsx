import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getOfferedCourseUploadPermissions } from "../../api/hodUploadAllocationApi";
import {
  addWeeklyTopic,
  getWeeklyContentShared,
  loadWeeklyContentFromDatabase,
  updateTopicProgress,
  uploadWeeklyContentFile,
} from "../../api/teacherApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import AddHeaderButton from "../../components/AddHeaderButton.jsx";
import { showAlert } from "../../utils/dialogs";
import { canUploadWeeklyContentFromPermissions } from "../../utils/uploadAllocationHelpers";

/** Leaf topics use their own flag; parents are covered only when every nested sub-topic is covered. */
function isTopicFullyCovered(topic) {
  const children = topic.children ?? [];
  if (children.length === 0) {
    return Boolean(topic.isCompleted);
  }
  return children.every((child) => isTopicFullyCovered(child));
}

export default function WeeklyContentScreen() {
  const { offeredCourseId: oc } = useParams();
  const offeredCourseId = Number(oc);
  const [searchParams] = useSearchParams();
  const teacherUserId = Number(searchParams.get("teacherUserId")) || undefined;

  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [uploadPermissions, setUploadPermissions] = useState(null);
  const [loading, setLoading] = useState(true);
  const canUploadWeeklyContent = canUploadWeeklyContentFromPermissions(uploadPermissions);
  const [actionModal, setActionModal] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [weekNo, setWeekNo] = useState("");
  const [topicTitle, setTopicTitle] = useState("");
  const [cloCodes, setCloCodes] = useState("");
  const [subTopicModal, setSubTopicModal] = useState(false);
  const [subTopicContext, setSubTopicContext] = useState(null);
  const [subTopicTitle, setSubTopicTitle] = useState("");
  const [subTopicCloCodes, setSubTopicCloCodes] = useState("");

  const loadData = async () => {
    try {
      const [result, permissions] = await Promise.all([
        getWeeklyContentShared(offeredCourseId),
        getOfferedCourseUploadPermissions(offeredCourseId).catch(() => ({
          clos: true,
          configured: false,
        })),
      ]);
      setData(result);
      setUploadPermissions(permissions);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [offeredCourseId]);

  const handleToggleTopic = async (topic) => {
    const hasChildren = (topic.children?.length ?? 0) > 0;
    if (hasChildren) {
      showAlert(
        "Sub-topics pending",
        "Complete all nested sub-topics before this topic can be marked covered."
      );
      return;
    }

    try {
      const result = await updateTopicProgress(
        offeredCourseId,
        topic.topicId,
        teacherUserId,
        !topic.isCompleted
      );
      setData(result);
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const handleLoadFromDatabase = async () => {
    try {
      setActionModal(false);
      const result = await loadWeeklyContentFromDatabase(offeredCourseId);
      setData(result);
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const handleSaveTopic = async () => {
    if (!weekNo || !topicTitle.trim()) {
      showAlert("Validation", "Week number and topic are required.");
      return;
    }
    try {
      const roots = data?.weeks ?? [];
      const rootMax =
        roots.reduce((max, t) => Math.max(max, Number(t.displayOrder ?? 0)), 0) || 0;

      const payload = {
        teacherUserId,
        weekNo: Number(weekNo),
        topicTitle: topicTitle.trim(),
        cloCodes: cloCodes.split(",").map((x) => x.trim()).filter(Boolean),
        displayOrder: rootMax + 1,
      };
      const result = await addWeeklyTopic(offeredCourseId, payload);
      setData(result);
      setAddModal(false);
      setWeekNo("");
      setTopicTitle("");
      setCloCodes("");
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const openSubTopicModal = (parentTopicId, weekNum, parentTitle) => {
    if (!weekNum || weekNum <= 0) {
      showAlert("Validation", "This week has no week number; add sub-topics from the main Add flow.");
      return;
    }
    setSubTopicContext({ parentTopicId, weekNo: weekNum, parentTitle });
    setSubTopicTitle("");
    setSubTopicCloCodes("");
    setSubTopicModal(true);
  };

  const handleSaveSubTopic = async () => {
    if (!subTopicContext || !subTopicTitle.trim()) {
      showAlert("Validation", "Sub-topic title is required.");
      return;
    }
    try {
      const parentTopicId = subTopicContext.parentTopicId;
      const findNode = (nodes, id) => {
        for (const n of nodes || []) {
          if (n.topicId === id) return n;
          const found = findNode(n.children, id);
          if (found) return found;
        }
        return null;
      };
      const parentNode = findNode(data?.weeks, parentTopicId);
      const siblings = parentNode?.children ?? [];
      const sibMax =
        siblings.reduce((max, t) => Math.max(max, Number(t.displayOrder ?? 0)), 0) || 0;

      const payload = {
        teacherUserId,
        weekNo: Number(subTopicContext.weekNo),
        parentTopicId,
        topicTitle: subTopicTitle.trim(),
        cloCodes: subTopicCloCodes.split(",").map((x) => x.trim()).filter(Boolean),
        displayOrder: sibMax + 1,
      };
      const result = await addWeeklyTopic(offeredCourseId, payload);
      setData(result);
      setSubTopicModal(false);
      setSubTopicContext(null);
      setSubTopicTitle("");
      setSubTopicCloCodes("");
      requestAnimationFrame(() => {
        const el =
          document.getElementById(`topic-children-${parentTopicId}`) ||
          document.getElementById(`week-children-${parentTopicId}`);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (f) setSelectedFile(f);
  };

  const handleUploadFile = async () => {
    if (!selectedFile) {
      showAlert("File", "Please select a .xlsx file.");
      return;
    }
    try {
      const result = await uploadWeeklyContentFile(offeredCourseId, teacherUserId, selectedFile);
      showAlert("Success", result.message || "Uploaded successfully.");
      setUploadModal(false);
      setSelectedFile(null);
      loadData();
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
      </div>
    );
  }

  return (
    <div className="relative min-h-full bg-page">
      <div className="border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-start gap-3">
            <PageBackButton className="mt-0.5 shrink-0" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Weekly Content</h1>
              <p className="mt-0.5 text-xs text-gray-500">
                {canUploadWeeklyContent ? "Manage topics and progress" : "View topics and track your progress"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canUploadWeeklyContent && (
              <AddHeaderButton label="Add Content" onClick={() => setActionModal(true)} />
            )}
            <button
              type="button"
              onClick={() =>
                navigate(`/teacher/course/${offeredCourseId}/sync?teacherUserId=${teacherUserId ?? ""}`)
              }
              className="app-btn-primary h-9 shrink-0 rounded-lg px-3 text-sm"
            >
              Compare
            </button>
          </div>
        </div>
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        {data?.isSharedWeeklyContent && (
          <div className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Weekly content outline is shared from{" "}
            <span className="font-semibold">
              {data.sharedFromSectionName || "another section"}
            </span>{" "}
            of the same subject. Your progress is tracked separately for your section.
          </div>
        )}

        {data?.weeks?.map((week, index) => (
          <TopicCard
            key={week.topicId}
            topic={week}
            index={index}
            canUpload={canUploadWeeklyContent}
            onToggle={handleToggleTopic}
            onAddSubTopic={openSubTopicModal}
          />
        ))}
        {data?.weeks?.length === 0 && (
          <div className="mt-16 text-center">
            <p className="text-gray-600">No weekly content uploaded yet.</p>
            {canUploadWeeklyContent ? (
              <button
                type="button"
                onClick={() => setActionModal(true)}
                className="app-btn-primary mt-4 rounded-lg px-5 py-3 font-bold"
              >
                Add Weekly Content
              </button>
            ) : (
              <p className="mt-3 text-sm text-gray-500">
                Only the HOD-allocated teacher for this subject can upload weekly content.
              </p>
            )}
          </div>
        )}
      </div>

      {actionModal && (
        <ModalBackdrop onClose={() => setActionModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex-1 text-center text-xl font-extrabold">Weekly Content</h2>
              <button type="button" className="text-2xl text-gray-500" onClick={() => setActionModal(false)}>
                ×
              </button>
            </div>
            <button
              type="button"
              className="app-btn-primary app-btn-primary-block mb-3 rounded-md py-3 font-bold"
              onClick={() => {
                setActionModal(false);
                setUploadModal(true);
              }}
            >
              Upload from file
            </button>
            <button
              type="button"
              className="app-btn-primary app-btn-primary-block mb-3 rounded-md py-3 font-bold"
              onClick={handleLoadFromDatabase}
            >
              Load from Database
            </button>
            <button
              type="button"
              className="app-btn-primary app-btn-primary-block rounded-md py-3 font-bold"
              onClick={() => {
                setActionModal(false);
                setAddModal(true);
              }}
            >
              Add New Weekly Content
            </button>
          </div>
        </ModalBackdrop>
      )}

      {addModal && (
        <ModalBackdrop onClose={() => setAddModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex-1 text-center text-xl font-extrabold">Add Weekly Content</h2>
              <button type="button" className="text-2xl text-gray-500" onClick={() => setAddModal(false)}>
                ×
              </button>
            </div>
            <p className="mb-4 text-center text-sm text-gray-500">
              Add a new weekly topic with optional CLO mapping.
            </p>
            <label className="mt-2 block text-sm font-bold">Week Number</label>
            <input
              className="mb-3 mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              value={weekNo}
              onChange={(e) => setWeekNo(e.target.value)}
              inputMode="numeric"
              placeholder="e.g., 13"
            />
            <label className="mt-2 block text-sm font-bold">Topic</label>
            <input
              className="mb-3 mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              value={topicTitle}
              onChange={(e) => setTopicTitle(e.target.value)}
              placeholder="e.g., Graph Algorithms"
            />
            <label className="mt-2 block text-sm font-bold">CLO Codes</label>
            <input
              className="mb-4 mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              value={cloCodes}
              onChange={(e) => setCloCodes(e.target.value)}
              placeholder="e.g., CLO1, CLO2"
            />
            <button
              type="button"
              onClick={handleSaveTopic}
              className="app-btn-primary app-btn-primary-block rounded-md py-3 font-extrabold"
            >
              Save Topic
            </button>
          </div>
        </ModalBackdrop>
      )}

      {subTopicModal && subTopicContext && (
        <ModalBackdrop
          onClose={() => {
            setSubTopicModal(false);
            setSubTopicContext(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex-1 text-center text-xl font-extrabold">Add sub-topic</h2>
              <button
                type="button"
                className="text-2xl text-gray-500"
                onClick={() => {
                  setSubTopicModal(false);
                  setSubTopicContext(null);
                }}
              >
                ×
              </button>
            </div>
            <p className="mb-4 text-center text-sm text-gray-600">
              Under <span className="font-bold">{subTopicContext.parentTitle}</span> · Week #
              {String(subTopicContext.weekNo).padStart(2, "0")}
            </p>
            <label className="mt-2 block text-sm font-bold">Sub-topic title</label>
            <input
              className="mb-3 mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              value={subTopicTitle}
              onChange={(e) => setSubTopicTitle(e.target.value)}
              placeholder="e.g., Measurement errors"
            />
            <label className="mt-2 block text-sm font-bold">CLO codes (optional)</label>
            <input
              className="mb-4 mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              value={subTopicCloCodes}
              onChange={(e) => setSubTopicCloCodes(e.target.value)}
              placeholder="e.g., CLO1"
            />
            <button
              type="button"
              onClick={handleSaveSubTopic}
              className="app-btn-primary app-btn-primary-block rounded-md py-3 font-extrabold"
            >
              Save sub-topic
            </button>
          </div>
        </ModalBackdrop>
      )}

      {uploadModal && (
        <ModalBackdrop onClose={() => setUploadModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex-1 text-center text-xl font-extrabold">Upload</h2>
              <button type="button" className="text-2xl text-gray-500" onClick={() => setUploadModal(false)}>
                ×
              </button>
            </div>
            <label className="text-sm font-bold">Upload weekly content file</label>
            <label className="mt-2 flex cursor-pointer items-center justify-between rounded-md bg-gray-100 px-3 py-3">
              <span className="truncate text-gray-600">{selectedFile?.name || "Select .xlsx file"}</span>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={pickFile} />
              <span>⇧</span>
            </label>
            <button
              type="button"
              onClick={handleUploadFile}
              className="mt-4 w-full rounded-md bg-slate-500 py-3 font-extrabold text-white"
            >
              Upload
            </button>
          </div>
        </ModalBackdrop>
      )}
    </div>
  );
}

function ModalBackdrop({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div onClick={(e) => e.stopPropagation()} role="presentation">
        {children}
      </div>
    </div>
  );
}

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

function TopicCard({ topic, index, canUpload = false, onToggle, onAddSubTopic }) {
  const [expanded, setExpanded] = useState(false);

  const weekNo = topic.weekNo != null ? Number(topic.weekNo) : index + 1;
  const hasChildren = (topic.children?.length ?? 0) > 0;
  const subTopicCount = topic.children?.length ?? 0;
  const coverage = getTopicCoverageDetails(topic);

  const palette = WEEK_PALETTES[index % WEEK_PALETTES.length];

  const toggleWeekExpand = () => {
    setExpanded((prev) => {
      const next = !prev;
      if (next) {
        requestAnimationFrame(() => {
          document.getElementById(`week-children-${topic.topicId}`)?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        });
      }
      return next;
    });
  };

  return (
    <div className="mb-3.5 rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm transition-all dark:border-[#1b2c2e] dark:bg-[#0c181a] dark:hover:border-[#274347]">
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
            onClick={toggleWeekExpand}
            className="line-clamp-1 text-left text-sm font-bold text-gray-900 transition hover:text-emerald-500 dark:text-white dark:hover:text-emerald-400"
          >
            Week #{String(weekNo).padStart(2, "0")} — {topic.topicTitle}
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

        {/* Right Status & Controls */}
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

          {/* Add Sub-topic Button */}
          {canUpload && (
            <button
              type="button"
              onClick={() => onAddSubTopic(topic.topicId, weekNo, topic.topicTitle)}
              className={`flex items-center gap-1 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition ${palette.btnStyle}`}
            >
              <span>Add sub-topic</span>
              <span className="text-xs">&gt;</span>
            </button>
          )}

          {/* Chevron expand button */}
          <button
            type="button"
            onClick={toggleWeekExpand}
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
        <div
          id={`week-children-${topic.topicId}`}
          className="mt-3.5 rounded-xl border border-gray-200 bg-gray-50/70 p-3 shadow-inner dark:border-[#1b2c2e] dark:bg-[#071113]"
        >
          {hasChildren ? (
            topic.children.map((child) => (
              <TopicNode
                key={child.topicId}
                topic={child}
                level={0}
                weekNo={weekNo}
                canUpload={canUpload}
                onToggle={onToggle}
                onAddSubTopic={onAddSubTopic}
              />
            ))
          ) : (
            <p className="px-4 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
              {canUpload ? (
                <>
                  No sub-topics yet. Use the{" "}
                  <span className="font-bold text-emerald-500">Add sub-topic</span> button to add one.
                </>
              ) : (
                "No sub-topics for this week yet."
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TopicNode({ topic, level, weekNo, canUpload = false, onToggle, onAddSubTopic }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = (topic.children?.length ?? 0) > 0;
  const fullyCovered = isTopicFullyCovered(topic);
  const pad = 16 + level * 20;

  const toggleBranchExpand = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setExpanded((prev) => {
      const next = !prev;
      if (next) {
        requestAnimationFrame(() => {
          document.getElementById(`topic-children-${topic.topicId}`)?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        });
      }
      return next;
    });
  };

  const onTitleClick = (e) => {
    e.stopPropagation();
    if (hasChildren) toggleBranchExpand(null);
    else onToggle(topic);
  };

  return (
    <div>
      <div
        className="flex min-h-[68px] items-center gap-3 border-b border-gray-200 pr-2 dark:border-[#1b2c2e]"
        style={{ paddingLeft: pad }}
      >
        <button
          type="button"
          className="flex shrink-0 items-center py-3"
          onClick={() => onToggle(topic)}
          aria-label={fullyCovered ? "Mark incomplete" : "Mark complete"}
        >
          <span
            className={`flex h-6 w-6 items-center justify-center rounded border-2 ${
              fullyCovered
                ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
                : "border-gray-300 dark:border-gray-600"
            }`}
          >
            {fullyCovered ? "✓" : ""}
          </span>
        </button>
        <button
          type="button"
          className={`min-w-0 flex-1 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 ${
            hasChildren ? "hover:text-emerald-600 dark:hover:text-emerald-400" : ""
          }`}
          onClick={onTitleClick}
          aria-expanded={hasChildren ? expanded : undefined}
        >
          {topic.topicTitle}
          {hasChildren && !expanded && (
            <span className="ml-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
              ({topic.children.length} nested — tap to expand)
            </span>
          )}
        </button>
        <div className="flex shrink-0 items-center gap-5">
          <button
            type="button"
            onClick={() => onToggle(topic)}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
              fullyCovered
                ? "border-emerald-500 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                : "border-gray-300 dark:border-gray-600"
            }`}
            aria-label={fullyCovered ? "Mark incomplete" : "Mark complete"}
          >
            {fullyCovered ? "✓" : ""}
          </button>
          {canUpload && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddSubTopic(topic.topicId, weekNo, topic.topicTitle);
              }}
              className="app-btn-primary shrink-0 rounded-full px-2.5 py-1 text-[10px] leading-tight sm:text-xs"
              title="Add nested sub-topic"
              aria-label="Add nested sub-topic"
            >
              Add
            </button>
          )}
          {hasChildren ? (
            <button
              type="button"
              onClick={toggleBranchExpand}
              className="week-card__chevron flex h-11 w-11 items-center justify-center rounded-full text-2xl"
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse nested topics" : "Expand nested topics"}
            >
              <span className={`inline-block transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}>
                ›
              </span>
            </button>
          ) : (
            <span className="inline-block w-11 shrink-0" aria-hidden />
          )}
        </div>
      </div>
      {hasChildren && expanded && (
        <div id={`topic-children-${topic.topicId}`} className="week-topic-panel">
          {topic.children.map((child) => (
            <TopicNode
              key={child.topicId}
              topic={child}
              level={level + 1}
              weekNo={weekNo}
              canUpload={canUpload}
              onToggle={onToggle}
              onAddSubTopic={onAddSubTopic}
            />
          ))}
        </div>
      )}
    </div>
  );
}
