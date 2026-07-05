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
              className="flex h-9 shrink-0 items-center rounded-lg bg-teal-700 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
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
                className="mt-4 rounded-lg bg-brand-dark px-5 py-3 font-bold text-white"
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
              className="mb-3 w-full rounded-md bg-brand-dark py-3 font-bold text-white"
              onClick={() => {
                setActionModal(false);
                setUploadModal(true);
              }}
            >
              Upload from file
            </button>
            <button
              type="button"
              className="mb-3 w-full rounded-md bg-brand-dark py-3 font-bold text-white"
              onClick={handleLoadFromDatabase}
            >
              Load from Database
            </button>
            <button
              type="button"
              className="w-full rounded-md bg-brand-dark py-3 font-bold text-white"
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
              className="w-full rounded-md bg-brand-dark py-3 font-extrabold text-white"
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
              className="w-full rounded-md bg-brand-dark py-3 font-extrabold text-white"
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

function TopicCard({ topic, index, canUpload = false, onToggle, onAddSubTopic }) {
  const [expanded, setExpanded] = useState(false);

  const fullyCovered = isTopicFullyCovered(topic);
  const bg = fullyCovered
    ? "bg-emerald-200"
    : index <= 2
      ? "bg-yellow-100"
      : "bg-emerald-50";

  const weekNo = topic.weekNo != null ? Number(topic.weekNo) : null;
  const hasChildren = (topic.children?.length ?? 0) > 0;

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
    <div className={`mb-3 rounded-lg border border-emerald-100 p-4 ${bg}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="min-w-0 flex-1 py-1 text-left text-sm font-semibold text-gray-900 hover:opacity-80"
          onClick={toggleWeekExpand}
          aria-expanded={expanded}
        >
          Week #{String(topic.weekNo || "").padStart(2, "0")} — {topic.topicTitle}
        </button>
        {canUpload && (
          <button
            type="button"
            onClick={() => onAddSubTopic(topic.topicId, weekNo, topic.topicTitle)}
            className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-dark"
            title="Add sub-topic under this week"
            aria-label="Add sub-topic under this week"
          >
            Add sub-topic
          </button>
        )}
        <button
          type="button"
          onClick={toggleWeekExpand}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-50 text-2xl text-gray-700 transition hover:bg-purple-100"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse week topics" : "Expand week topics"}
        >
          <span
            className={`inline-block transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
            aria-hidden
          >
            ›
          </span>
        </button>
      </div>
      {expanded && (
        <div
          id={`week-children-${topic.topicId}`}
          className="mt-3 scroll-mt-24 border border-emerald-200 bg-white/60"
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
            <p className="px-4 py-4 text-center text-sm text-gray-500">
              {canUpload
                ? (
                    <>
                      No sub-topics yet. Use the{" "}
                      <span className="font-bold text-brand-dark">Add sub-topic</span> button to add one.
                    </>
                  )
                : "No sub-topics for this week yet."}
            </p>
          )}
        </div>
      )}
      {!expanded && hasChildren && (
        <p className="mt-2 text-center text-xs font-semibold text-gray-500">
          {topic.children.length} sub-topic{topic.children.length === 1 ? "" : "s"} hidden — tap the week title or ›
          to expand
        </p>
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
        className="flex min-h-[68px] items-center gap-3 border-b border-gray-200 pr-2"
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
              fullyCovered ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300"
            }`}
          >
            {fullyCovered ? "✓" : ""}
          </span>
        </button>
        <button
          type="button"
          className={`min-w-0 flex-1 py-3 text-left text-sm font-semibold text-gray-900 ${
            hasChildren ? "hover:text-brand-dark" : ""
          }`}
          onClick={onTitleClick}
          aria-expanded={hasChildren ? expanded : undefined}
        >
          {topic.topicTitle}
          {hasChildren && !expanded && (
            <span className="ml-2 text-xs font-semibold text-gray-500">
              ({topic.children.length} nested — tap to expand)
            </span>
          )}
        </button>
        <div className="flex shrink-0 items-center gap-5">
          <button
            type="button"
            onClick={() => onToggle(topic)}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
              fullyCovered ? "border-emerald-500 text-emerald-600" : "border-gray-300"
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
              className="shrink-0 rounded-full bg-brand/90 px-2.5 py-1 text-[10px] font-semibold leading-tight text-white shadow-sm hover:bg-brand-dark sm:text-xs"
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
              className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-50 text-2xl text-gray-700 hover:bg-purple-100"
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
        <div id={`topic-children-${topic.topicId}`} className="bg-white/40">
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
