import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getCLOsByProgramCourse } from "../../api/closApi";
import { getOfferedCourseUploadPermissions } from "../../api/hodUploadAllocationApi";
import {
  addWeeklyTopic,
  applyWeeklyLoadScheme,
  getTeacherCourses,
  getWeeklyContentShared,
  getWeeklyLoadSchemes,
  getWeeklyLoadSchemeTopics,
  submitContentForReview,
  updateTopicProgress,
  uploadWeeklyContentFile,
} from "../../api/teacherApi";
import { findTeacherSiblingSections } from "../../utils/weeklyContentSharing";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import AddHeaderButton from "../../components/AddHeaderButton.jsx";
import AppSelect from "../../components/AppSelect.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";
import { asList, getAuthUserId } from "../../utils/helpers";
import { sortClos } from "../../utils/outcomeHelpers";
import {
  canManageClosFromPermissions,
  canUploadWeeklyContentFromPermissions,
  filterClosForViewer,
  pickContentTypeStatus,
  pickHodFeedback,
} from "../../utils/uploadAllocationHelpers";
import { HodRejectionBanner, useHodRejectionAlert } from "../../components/HodRejectionNotice.jsx";

/** Leaf topics use their own flag; parents are covered only when every nested sub-topic is covered. */
function isTopicFullyCovered(topic) {
  const children = topic.children ?? [];
  if (children.length === 0) {
    return Boolean(topic.isCompleted);
  }
  return children.every((child) => isTopicFullyCovered(child));
}

function collectLeafTopics(nodes, out = []) {
  for (const node of nodes || []) {
    const kids = node.children ?? [];
    if (kids.length === 0) out.push(node);
    else collectLeafTopics(kids, out);
  }
  return out;
}

function syncPrefKey(programCourseId) {
  return `weeklyTopicSyncSections:v1:${programCourseId || "global"}`;
}

function readSyncPref(programCourseId) {
  try {
    const raw = localStorage.getItem(syncPrefKey(programCourseId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      skipModal: Boolean(parsed.skipModal),
      siblingIds: Array.isArray(parsed.siblingIds)
        ? parsed.siblingIds.map(Number).filter((id) => id > 0)
        : [],
    };
  } catch {
    return null;
  }
}

function writeSyncPref(programCourseId, pref) {
  try {
    localStorage.setItem(syncPrefKey(programCourseId), JSON.stringify(pref));
  } catch {
    // ignore
  }
}

function clearSyncPref(programCourseId) {
  try {
    localStorage.removeItem(syncPrefKey(programCourseId));
  } catch {
    // ignore
  }
}

export default function WeeklyContentScreen() {
  const { user } = useContext(AuthContext);
  const { offeredCourseId: oc } = useParams();
  const offeredCourseId = Number(oc);
  const [searchParams] = useSearchParams();
  const routeTeacher = searchParams.get("teacherUserId");
  const teacherUserId =
    routeTeacher != null && routeTeacher !== ""
      ? Number(routeTeacher) || getAuthUserId(user)
      : getAuthUserId(user);

  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [uploadPermissions, setUploadPermissions] = useState(null);
  const [loading, setLoading] = useState(true);
  const canUploadWeeklyContent = canUploadWeeklyContentFromPermissions(uploadPermissions);
  const canManageClos = canManageClosFromPermissions(uploadPermissions);
  const isAllocatedTeacher = Boolean(
    uploadPermissions?.isAllocatedTeacher ?? uploadPermissions?.IsAllocatedTeacher
  );
  const [actionModal, setActionModal] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [weekNo, setWeekNo] = useState("");
  const [topicTitle, setTopicTitle] = useState("");
  const [cloCodes, setCloCodes] = useState([]);
  const [courseClos, setCourseClos] = useState([]);
  const [subTopicModal, setSubTopicModal] = useState(false);
  const [subTopicContext, setSubTopicContext] = useState(null);
  const [subTopicTitle, setSubTopicTitle] = useState("");
  const [subTopicCloCodes, setSubTopicCloCodes] = useState([]);
  const [isSubmittingWeekly, setIsSubmittingWeekly] = useState(false);
  const [applyModal, setApplyModal] = useState(null);
  const [selectedSiblingIds, setSelectedSiblingIds] = useState([]);
  const [rememberSyncChoice, setRememberSyncChoice] = useState(true);
  const [isApplyingTopic, setIsApplyingTopic] = useState(false);
  const [siblingSections, setSiblingSections] = useState([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState([]);
  const [loadSchemeModal, setLoadSchemeModal] = useState(false);
  const [loadSchemes, setLoadSchemes] = useState([]);
  const [loadSchemesLoading, setLoadSchemesLoading] = useState(false);
  const [selectedLoadScheme, setSelectedLoadScheme] = useState(null);
  const [loadTopics, setLoadTopics] = useState([]);
  const [loadTopicsLoading, setLoadTopicsLoading] = useState(false);
  const [selectedTopicIds, setSelectedTopicIds] = useState([]);
  const [isApplyingLoadScheme, setIsApplyingLoadScheme] = useState(false);
  const uploadedCloOptions = useMemo(() => {
    const list = filterClosForViewer(courseClos, canManageClos, isAllocatedTeacher)
      .map((item) => ({
        cloId: item.cloId ?? item.CloId,
        cloCode: String(item.cloCode ?? item.CloCode ?? "").trim(),
        cloDescription: String(item.cloDescription ?? item.CloDescription ?? "").trim(),
      }))
      .filter((item) => item.cloCode);
    return sortClos(list);
  }, [courseClos, canManageClos, isAllocatedTeacher]);
  const programCourseId = data?.programCourseId ?? data?.ProgramCourseId;
  const weeklyStatus = pickContentTypeStatus(data?.contentStatuses ?? data?.ContentStatuses, "WeeklyContent");
  const weeklyPending = String(weeklyStatus).toLowerCase() === "pendingreview";
  const weeklyRejected = String(weeklyStatus).toLowerCase() === "rejected";
  const weeklyRejectReason = pickHodFeedback(data?.contentStatuses ?? data?.ContentStatuses, "WeeklyContent");
  useHodRejectionAlert(weeklyRejected, "Weekly content", weeklyRejectReason, !loading);

  const loadData = async () => {
    try {
      const [result, permissions, courses] = await Promise.all([
        getWeeklyContentShared(offeredCourseId, teacherUserId),
        getOfferedCourseUploadPermissions(offeredCourseId, teacherUserId).catch(() => ({
          clos: false,
          folderTemplate: false,
          configured: false,
        })),
        teacherUserId
          ? getTeacherCourses(teacherUserId).catch(() => [])
          : Promise.resolve([]),
      ]);
      const fromApi = result?.siblingSections ?? [];
      const fromCourses = findTeacherSiblingSections(courses, offeredCourseId);
      setSiblingSections(fromApi.length > 0 ? fromApi : fromCourses);
      setData(result);
      setUploadPermissions(permissions);

      const pcId = result?.programCourseId ?? result?.ProgramCourseId;
      if (pcId && teacherUserId) {
        const clos = await getCLOsByProgramCourse(pcId, {
          offeredCourseId,
          teacherUserId,
        }).catch(() => []);
        setCourseClos(asList(clos));
      } else {
        setCourseClos([]);
      }
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [offeredCourseId]);

  const programCourseIdForPref = data?.programCourseId ?? data?.ProgramCourseId;

  const validSiblingIds = useMemo(
    () => siblingSections.map((s) => Number(s.offeredCourseId)).filter((id) => id > 0),
    [siblingSections]
  );

  const applyTopicsProgress = async (topics, isCompleted, alsoOfferedCourseIds = [], { remember = false } = {}) => {
    const list = (topics || []).filter(Boolean);
    if (list.length === 0) return;
    try {
      setIsApplyingTopic(true);
      const extraIds = (alsoOfferedCourseIds || []).filter(
        (id) => Number(id) > 0 && Number(id) !== Number(offeredCourseId)
      );

      if (remember) {
        writeSyncPref(programCourseIdForPref, {
          skipModal: true,
          siblingIds: extraIds,
        });
      }

      let latest = null;
      for (const topic of list) {
        latest = await updateTopicProgress(
          offeredCourseId,
          topic.topicId,
          teacherUserId,
          isCompleted,
          extraIds
        );
        for (const extraId of extraIds) {
          await updateTopicProgress(extraId, topic.topicId, teacherUserId, isCompleted, []);
        }
      }
      if (latest) setData(latest);
      else await loadData();
      setBulkSelectedIds([]);
      setMultiSelectMode(false);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setIsApplyingTopic(false);
      setApplyModal(null);
    }
  };

  const openApplyModal = (topics, nextCompleted) => {
    const pref = readSyncPref(programCourseIdForPref);
    const preferred = (pref?.siblingIds || []).filter((id) => validSiblingIds.includes(id));
    setSelectedSiblingIds(preferred.length > 0 ? preferred : validSiblingIds);
    setRememberSyncChoice(true);
    setApplyModal({ topics, nextCompleted });
  };

  const handleToggleTopic = async (topic) => {
    const hasChildren = (topic.children?.length ?? 0) > 0;
    // Parent topics follow their sub-topics: checkbox is display-only until all children are done.
    if (hasChildren) {
      if (isTopicFullyCovered(topic)) {
        showAlert(
          "Already complete",
          "This topic is marked complete because all its sub-topics are done. Uncheck a sub-topic to change coverage."
        );
      } else {
        showAlert(
          "Sub-topics pending",
          "Tick every sub-topic first — then this main topic will become complete automatically."
        );
      }
      return;
    }
    if (isApplyingTopic) return;

    // Multi-select: gather several leaf topics, then apply once.
    if (multiSelectMode) {
      const id = Number(topic.topicId);
      setBulkSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
      return;
    }

    const nextCompleted = !topic.isCompleted;
    if (siblingSections.length > 0) {
      const pref = readSyncPref(programCourseIdForPref);
      if (pref?.skipModal) {
        const ids = (pref.siblingIds || []).filter((id) => validSiblingIds.includes(id));
        await applyTopicsProgress([topic], nextCompleted, ids);
        return;
      }
      openApplyModal([topic], nextCompleted);
      return;
    }

    await applyTopicsProgress([topic], nextCompleted, []);
  };

  const startBulkApply = (nextCompleted) => {
    const leaves = collectLeafTopics(data?.weeks ?? []);
    const selected = leaves.filter((t) => bulkSelectedIds.includes(Number(t.topicId)));
    if (selected.length === 0) {
      showAlert("Select topics", "Tick one or more topics first.");
      return;
    }
    if (siblingSections.length > 0) {
      openApplyModal(selected, nextCompleted);
      return;
    }
    applyTopicsProgress(selected, nextCompleted, []);
  };

  const siblingLabel = (section) => {
    const program = section.programCode || section.programName;
    return program ? `${program} · ${section.sectionName}` : section.sectionName;
  };

  const closeLoadSchemeModal = () => {
    setLoadSchemeModal(false);
    setLoadSchemes([]);
    setSelectedLoadScheme(null);
    setLoadTopics([]);
    setSelectedTopicIds([]);
  };

  const openLoadSchemeModal = async () => {
    setActionModal(false);
    setLoadSchemeModal(true);
    setSelectedLoadScheme(null);
    setLoadTopics([]);
    setSelectedTopicIds([]);
    setLoadSchemesLoading(true);
    try {
      const schemes = asList(await getWeeklyLoadSchemes(offeredCourseId, teacherUserId));
      setLoadSchemes(schemes);
    } catch (error) {
      showAlert("Error", error.message);
      setLoadSchemeModal(false);
    } finally {
      setLoadSchemesLoading(false);
    }
  };

  const handleSelectLoadScheme = async (scheme) => {
    const sourceSessionId = Number(scheme.sessionId ?? scheme.SessionId);
    if (!sourceSessionId) return;
    setSelectedLoadScheme(scheme);
    setLoadTopicsLoading(true);
    setLoadTopics([]);
    setSelectedTopicIds([]);
    try {
      const detail = await getWeeklyLoadSchemeTopics(
        offeredCourseId,
        sourceSessionId,
        teacherUserId
      );
      const items = asList(detail?.items ?? detail?.Items);
      setLoadTopics(items);
      setSelectedTopicIds(
        items
          .map((t) => Number(t.topicId ?? t.TopicId))
          .filter((id) => Number.isFinite(id) && id > 0)
      );
    } catch (error) {
      showAlert("Error", error.message);
      setSelectedLoadScheme(null);
    } finally {
      setLoadTopicsLoading(false);
    }
  };

  const toggleTopicSelection = (topicId) => {
    const id = Number(topicId);
    setSelectedTopicIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleApplyLoadScheme = async () => {
    const sourceSessionId = Number(
      selectedLoadScheme?.sessionId ?? selectedLoadScheme?.SessionId
    );
    if (!sourceSessionId) {
      showAlert("Validation", "Select a previous scheme first.");
      return;
    }
    if (selectedTopicIds.length === 0) {
      showAlert("Validation", "Select at least one topic to load.");
      return;
    }
    try {
      setIsApplyingLoadScheme(true);
      const result = await applyWeeklyLoadScheme(offeredCourseId, {
        teacherUserId,
        sourceSessionId,
        topicIds: selectedTopicIds,
      });
      const hasWeeks =
        Array.isArray(result?.weeks) || Array.isArray(result?.Weeks);
      if (hasWeeks) {
        setData(result);
      } else {
        await loadData();
      }
      showAlert(
        "Loaded",
        result?.message ||
          result?.Message ||
          `Loaded ${result?.createdCount ?? result?.CreatedCount ?? selectedTopicIds.length} topic(s) from previous scheme.`
      );
      setIsApplyingLoadScheme(false);
      closeLoadSchemeModal();
    } catch (error) {
      showAlert("Error", error.message);
      setIsApplyingLoadScheme(false);
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
        cloCodes,
        displayOrder: rootMax + 1,
      };
      const result = await addWeeklyTopic(offeredCourseId, payload);
      setData(result);
      setAddModal(false);
      setWeekNo("");
      setTopicTitle("");
      setCloCodes([]);
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
    setSubTopicCloCodes([]);
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
        cloCodes: subTopicCloCodes,
        displayOrder: sibMax + 1,
      };
      const result = await addWeeklyTopic(offeredCourseId, payload);
      setData(result);
      setSubTopicModal(false);
      setSubTopicContext(null);
      setSubTopicTitle("");
      setSubTopicCloCodes([]);
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
    if (!f) return;
    const name = f.name?.toLowerCase() || "";
    if (!name.endsWith(".xlsx")) {
      showAlert("Invalid File", "Please select a .xlsx Excel file.");
      e.target.value = "";
      return;
    }
    setSelectedFile(f);
  };

  const handleSubmitWeeklyForReview = async () => {
    if (!canUploadWeeklyContent) {
      showAlert("Permission Denied", "Only teachers authorized by HOD can submit weekly content.");
      return;
    }
    if (!programCourseId || !teacherUserId) {
      showAlert("Error", "Unable to submit weekly content. Missing course or user. Try logging in again.");
      return;
    }
    if (!(data?.weeks?.length > 0)) {
      showAlert("Nothing to upload", "Add weekly topics first, then upload for HOD approval.");
      return;
    }
    if (weeklyPending) {
      showAlert("Already submitted", "Weekly content is already awaiting HOD review.");
      return;
    }

    const confirmed = await showConfirm(
      "Upload for HOD approval",
      "Submit weekly content to HOD? The HOD will see it on the Notifications page with a red unread marker."
    );
    if (!confirmed) return;

    try {
      setIsSubmittingWeekly(true);
      await submitContentForReview(programCourseId, {
        teacherUserId,
        offeredCourseId,
        contentTypeCode: "WeeklyContent",
      });
      showAlert(
        "Submitted",
        "Weekly content submitted to HOD for approval. You will be notified after review."
      );
      await loadData();
    } catch (error) {
      showAlert("Upload failed", error.message || "Could not submit weekly content.");
    } finally {
      setIsSubmittingWeekly(false);
    }
  };

  const handleUploadFile = async () => {
    if (!selectedFile) {
      showAlert("File", "Please select a .xlsx Excel file.");
      return;
    }
    if (!teacherUserId) {
      showAlert("Error", "Unable to upload. Missing user. Try logging in again.");
      return;
    }
    try {
      const result = await uploadWeeklyContentFile(offeredCourseId, teacherUserId, selectedFile);
      const created = result.createdTopics ?? result.CreatedTopics ?? 0;
      const existing = result.existingTopics ?? result.ExistingTopics ?? 0;
      const errors = result.errors ?? result.Errors ?? [];
      const extra =
        Array.isArray(errors) && errors.length > 0
          ? `\n\n${errors.slice(0, 5).join("\n")}`
          : "";
      if (created <= 0 && existing <= 0) {
        showAlert(
          "No topics imported",
          `${result.message || result.Message || "Nothing was saved."}${extra}`
        );
        return;
      }
      showAlert(
        "Uploaded",
        `${result.message || result.Message || "Uploaded successfully."}${extra}\n\nCreated: ${created} · Existing: ${existing}`
      );
      setUploadModal(false);
      setSelectedFile(null);
      await loadData();
    } catch (error) {
      showAlert("Upload failed", error.message || "Could not upload this Excel file.");
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
            {canUploadWeeklyContent && (
              <button
                type="button"
                onClick={handleSubmitWeeklyForReview}
                disabled={isSubmittingWeekly || weeklyPending}
                className="app-btn-primary h-9 shrink-0 rounded-lg px-3 text-sm disabled:opacity-50"
                title={
                  weeklyPending
                    ? "Already awaiting HOD review"
                    : "Submit weekly content for HOD approval"
                }
              >
                {isSubmittingWeekly ? "Uploading…" : weeklyPending ? "Awaiting HOD" : "Upload for HOD"}
              </button>
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
        {weeklyRejected ? <HodRejectionBanner title="weekly content" reason={weeklyRejectReason} /> : null}
        {canUploadWeeklyContent && (
          <p className="mb-4 rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
            Add or import topics, then click <strong>Upload for HOD</strong>. HOD gets a notification
            (red dot on the bell) for weekly content, separate from CLO or mapping approvals.
            {weeklyPending ? " Status: awaiting HOD review." : ""}
          </p>
        )}
        {!canUploadWeeklyContent && (
          <p className="mb-4 text-sm text-gray-500">
            View-only: topics are shared from the allocated section. Your coverage is tracked for this section only.
          </p>
        )}
        {data?.isSharedWeeklyContent && (
          <p className="mb-4 text-sm text-gray-500">
            Outline shared from{" "}
            <span className="font-semibold text-gray-700">
              {data.sharedFromSectionName || "another section"}
            </span>
            . Progress is tracked separately for your section.
          </p>
        )}
        {(siblingSections.length > 0 || (data?.weeks?.length > 0)) && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {siblingSections.length > 0 ? (
              <p>
                You also teach this subject in{" "}
                <span className="font-semibold">
                  {siblingSections.map(siblingLabel).join(", ")}
                </span>
                . Select multiple topics, then mark them once for all chosen sections.
              </p>
            ) : (
              <p>Select multiple topics and mark them complete/incomplete in one go.</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setMultiSelectMode((v) => !v);
                  setBulkSelectedIds([]);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  multiSelectMode
                    ? "bg-emerald-700 text-white"
                    : "bg-white text-emerald-900 border border-emerald-300"
                }`}
              >
                {multiSelectMode ? "Multi-select on" : "Select multiple topics"}
              </button>
              {siblingSections.length > 0 && readSyncPref(programCourseIdForPref)?.skipModal ? (
                <button
                  type="button"
                  onClick={() => {
                    clearSyncPref(programCourseIdForPref);
                    showAlert("Reset", "Section choice will be asked again next time.");
                  }}
                  className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900"
                >
                  Reset saved sections
                </button>
              ) : null}
            </div>
          </div>
        )}

        {multiSelectMode && (
          <div className="sticky top-14 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand/30 bg-white px-4 py-3 shadow-sm">
            <p className="mr-auto text-sm font-semibold text-gray-800">
              {bulkSelectedIds.length} topic{bulkSelectedIds.length === 1 ? "" : "s"} selected
            </p>
            <button
              type="button"
              disabled={isApplyingTopic || bulkSelectedIds.length === 0}
              onClick={() => startBulkApply(true)}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              Mark complete
            </button>
            <button
              type="button"
              disabled={isApplyingTopic || bulkSelectedIds.length === 0}
              onClick={() => startBulkApply(false)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 disabled:opacity-50"
            >
              Mark incomplete
            </button>
            <button
              type="button"
              onClick={() => {
                setMultiSelectMode(false);
                setBulkSelectedIds([]);
              }}
              className="rounded-lg px-3 py-2 text-xs font-bold text-gray-500"
            >
              Cancel
            </button>
          </div>
        )}

        {data?.weeks?.length > 0 ? (
          <div className="space-y-4">
            {groupTopicsByWeek(data.weeks).map((group) => (
              <WeekGroup
                key={`week-${group.weekNo}`}
                weekNo={group.weekNo}
                topics={group.topics}
                canUpload={canUploadWeeklyContent}
                onToggle={handleToggleTopic}
                onAddSubTopic={openSubTopicModal}
                multiSelectMode={multiSelectMode}
                bulkSelectedIds={bulkSelectedIds}
              />
            ))}
          </div>
        ) : (
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
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0c181a] border border-transparent dark:border-white/10 p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex-1 text-center text-xl font-extrabold text-gray-900 dark:text-white">Weekly Content</h2>
              <button type="button" className="text-2xl text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white p-1" onClick={() => setActionModal(false)}>
                ×
              </button>
            </div>
            <button
              type="button"
              className="app-btn-primary app-btn-primary-block mb-3 min-h-[44px] rounded-md py-3 font-bold"
              onClick={() => {
                setActionModal(false);
                setUploadModal(true);
              }}
            >
              Upload from Excel
            </button>
            <button
              type="button"
              className="app-btn-primary app-btn-primary-block mb-3 min-h-[44px] rounded-md py-3 font-bold"
              onClick={openLoadSchemeModal}
            >
              Load from Database
            </button>
            <button
              type="button"
              className="app-btn-primary app-btn-primary-block min-h-[44px] rounded-md py-3 font-bold"
              onClick={() => {
                setActionModal(false);
                setWeekNo("");
                setTopicTitle("");
                setCloCodes([]);
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
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0c181a] border border-transparent dark:border-white/10 p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex-1 text-center text-xl font-extrabold text-gray-900 dark:text-white">Add Weekly Content</h2>
              <button type="button" className="text-2xl text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white p-1" onClick={() => setAddModal(false)}>
                ×
              </button>
            </div>
            <p className="mb-4 text-center text-sm text-gray-500 dark:text-gray-400">
              Add a new weekly topic with optional CLO mapping.
            </p>
            <label className="mt-2 block text-sm font-bold text-gray-700 dark:text-gray-300">Week Number</label>
            <input
              className="mb-3 mt-1 min-h-[40px] w-full rounded-md border border-gray-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#07858c]"
              value={weekNo}
              onChange={(e) => setWeekNo(e.target.value)}
              inputMode="numeric"
              placeholder="e.g., 13"
            />
            <label className="mt-2 block text-sm font-bold text-gray-700 dark:text-gray-300">Topic</label>
            <input
              className="mb-3 mt-1 min-h-[40px] w-full rounded-md border border-gray-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#07858c]"
              value={topicTitle}
              onChange={(e) => setTopicTitle(e.target.value)}
              placeholder="e.g., Graph Algorithms"
            />
            <label className="mt-2 block text-sm font-bold text-gray-700 dark:text-gray-300">CLO Codes</label>
            <CloCodePicker
              clos={uploadedCloOptions}
              selectedCodes={cloCodes}
              onChange={setCloCodes}
            />
            <button
              type="button"
              onClick={handleSaveTopic}
              className="app-btn-primary app-btn-primary-block min-h-[44px] rounded-md py-3 font-extrabold"
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
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0c181a] border border-transparent dark:border-white/10 p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex-1 text-center text-xl font-extrabold text-gray-900 dark:text-white">Add sub-topic</h2>
              <button
                type="button"
                className="text-2xl text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white p-1"
                onClick={() => {
                  setSubTopicModal(false);
                  setSubTopicContext(null);
                }}
              >
                ×
              </button>
            </div>
            <p className="mb-4 text-center text-sm text-gray-600 dark:text-gray-400">
              Under <span className="font-bold text-gray-900 dark:text-white">{subTopicContext.parentTitle}</span> · Week #
              {String(subTopicContext.weekNo).padStart(2, "0")}
            </p>
            <label className="mt-2 block text-sm font-bold text-gray-700 dark:text-gray-300">Sub-topic title</label>
            <input
              className="mb-3 mt-1 min-h-[40px] w-full rounded-md border border-gray-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#07858c]"
              value={subTopicTitle}
              onChange={(e) => setSubTopicTitle(e.target.value)}
              placeholder="e.g., Measurement errors"
            />
            <label className="mt-2 block text-sm font-bold text-gray-700 dark:text-gray-300">CLO codes (optional)</label>
            <CloCodePicker
              clos={uploadedCloOptions}
              selectedCodes={subTopicCloCodes}
              onChange={setSubTopicCloCodes}
            />
            <button
              type="button"
              onClick={handleSaveSubTopic}
              className="app-btn-primary app-btn-primary-block min-h-[44px] rounded-md py-3 font-extrabold"
            >
              Save sub-topic
            </button>
          </div>
        </ModalBackdrop>
      )}

      {applyModal && (
        <ModalBackdrop
          onClose={() => {
            if (!isApplyingTopic) setApplyModal(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0c181a] border border-transparent dark:border-white/10 p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex-1 text-center text-xl font-extrabold text-gray-900 dark:text-white">
                {applyModal.nextCompleted ? "Also mark other sections?" : "Also unmark other sections?"}
              </h2>
              <button
                type="button"
                className="text-2xl text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white p-1"
                disabled={isApplyingTopic}
                onClick={() => setApplyModal(null)}
              >
                ×
              </button>
            </div>
            <p className="mb-3 text-center text-sm text-gray-600 dark:text-gray-400">
              <span className="font-semibold text-gray-800 dark:text-white">
                {(applyModal.topics?.length ?? 0) > 1
                  ? `${applyModal.topics.length} topics`
                  : applyModal.topics?.[0]?.topicTitle || "Topic"}
              </span>
              {" · "}
              {applyModal.nextCompleted ? "Mark complete" : "Mark incomplete"} on this section
              {data?.sectionName ? ` (${data.sectionName})` : ""}. Tick any other sections to update
              together.
            </p>
            {(applyModal.topics?.length ?? 0) > 1 ? (
              <ul className="mb-3 max-h-28 list-disc space-y-0.5 overflow-y-auto rounded-lg bg-gray-50 dark:bg-white/5 px-5 py-2 text-left text-xs text-gray-600 dark:text-gray-300">
                {applyModal.topics.map((t) => (
                  <li key={t.topicId}>{t.topicTitle}</li>
                ))}
              </ul>
            ) : null}
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Sections</p>
              <div className="flex gap-2 text-xs font-bold">
                <button
                  type="button"
                  disabled={isApplyingTopic}
                  className="text-brand dark:text-brand-light"
                  onClick={() => setSelectedSiblingIds(validSiblingIds)}
                >
                  Select all
                </button>
                <button
                  type="button"
                  disabled={isApplyingTopic}
                  className="text-gray-500 dark:text-gray-400"
                  onClick={() => setSelectedSiblingIds([])}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="mb-3 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-3">
              {siblingSections.map((section) => {
                const id = Number(section.offeredCourseId);
                const checked = selectedSiblingIds.includes(id);
                return (
                  <label
                    key={id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg bg-white dark:bg-[#132226] border border-transparent dark:border-white/5 px-3 py-2 text-sm font-semibold text-gray-800 dark:text-gray-200 shadow-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isApplyingTopic}
                      onChange={() => {
                        setSelectedSiblingIds((prev) =>
                          checked ? prev.filter((x) => x !== id) : [...prev, id]
                        );
                      }}
                    />
                    {siblingLabel(section)}
                  </label>
                );
              })}
            </div>
            <label className="mb-4 flex cursor-pointer items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={rememberSyncChoice}
                disabled={isApplyingTopic}
                onChange={(e) => setRememberSyncChoice(e.target.checked)}
              />
              <span>Remember this — next time apply without asking again.</span>
            </label>
            <div className="space-y-2">
              <button
                type="button"
                disabled={isApplyingTopic}
                onClick={() =>
                  applyTopicsProgress(
                    applyModal.topics,
                    applyModal.nextCompleted,
                    selectedSiblingIds,
                    { remember: rememberSyncChoice }
                  )
                }
                className="app-btn-primary app-btn-primary-block min-h-[44px] rounded-md py-3 font-extrabold disabled:opacity-50"
              >
                {isApplyingTopic
                  ? "Saving…"
                  : selectedSiblingIds.length > 0
                    ? `Apply to this + ${selectedSiblingIds.length} section${selectedSiblingIds.length === 1 ? "" : "s"}`
                    : "Apply to this section only"}
              </button>
              <button
                type="button"
                disabled={isApplyingTopic}
                onClick={() =>
                  applyTopicsProgress(applyModal.topics, applyModal.nextCompleted, [], {
                    remember: false,
                  })
                }
                className="w-full min-h-[44px] rounded-md border border-gray-200 dark:border-white/15 bg-white dark:bg-white/5 py-3 text-sm font-extrabold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50"
              >
                This section only
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {uploadModal && (
        <ModalBackdrop onClose={() => setUploadModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0c181a] border border-transparent dark:border-white/10 p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex-1 text-center text-xl font-extrabold text-gray-900 dark:text-white">Upload</h2>
              <button type="button" className="text-2xl text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white p-1" onClick={() => setUploadModal(false)}>
                ×
              </button>
            </div>
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Upload weekly content Excel</label>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Excel (.xlsx) with WeekNo and TopicPath columns. Existing topics stay; new ones are added.
            </p>
            <label className="mt-2 flex min-h-[44px] cursor-pointer items-center justify-between rounded-md bg-gray-100 dark:bg-white/5 border border-transparent dark:border-white/10 px-3 py-3">
              <span className="truncate text-gray-600 dark:text-gray-300">
                {selectedFile?.name || "Select .xlsx file"}
              </span>
              <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={pickFile} />
              <span className="text-gray-500 dark:text-gray-400">⇧</span>
            </label>
            <button
              type="button"
              onClick={handleUploadFile}
              className="mt-4 w-full min-h-[44px] rounded-md bg-slate-500 py-3 font-extrabold text-white transition hover:bg-slate-600"
            >
              Upload
            </button>
          </div>
        </ModalBackdrop>
      )}

      {loadSchemeModal && (
        <ModalBackdrop
          onClose={() => {
            if (!isApplyingLoadScheme) closeLoadSchemeModal();
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0c181a] border border-transparent dark:border-white/10 p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex-1 text-center text-xl font-extrabold text-gray-900 dark:text-white">
                {selectedLoadScheme ? "Select topics" : "Load from previous scheme"}
              </h2>
              <button
                type="button"
                className="text-2xl text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white p-1"
                disabled={isApplyingLoadScheme}
                onClick={closeLoadSchemeModal}
              >
                ×
              </button>
            </div>

            {!selectedLoadScheme ? (
              <>
                <p className="mb-3 text-center text-sm text-gray-500 dark:text-gray-400">
                  Choose a previous scheme of study to copy weekly topics from.
                </p>
                {loadSchemesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
                  </div>
                ) : loadSchemes.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    No previous schemes with weekly topics were found for this subject.
                  </p>
                ) : (
                  <div className="mb-2 max-h-72 space-y-2 overflow-y-auto">
                    {loadSchemes.map((scheme) => {
                      const sid = Number(scheme.sessionId ?? scheme.SessionId);
                      const label =
                        scheme.schemeLabel ?? scheme.SchemeLabel ?? `Scheme ${sid}`;
                      const year = scheme.academicYear ?? scheme.AcademicYear;
                      const weekCount = scheme.weekCount ?? scheme.WeekCount;
                      const topicCount = scheme.topicCount ?? scheme.TopicCount;
                      return (
                        <button
                          key={sid}
                          type="button"
                          className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-left hover:border-brand hover:bg-brand-muted/20"
                          onClick={() => handleSelectLoadScheme(scheme)}
                        >
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{label}</p>
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {year ? `${year} · ` : ""}
                            {weekCount != null ? `${weekCount} week${weekCount === 1 ? "" : "s"}` : ""}
                            {topicCount != null
                              ? `${weekCount != null ? " · " : ""}${topicCount} topic${topicCount === 1 ? "" : "s"}`
                              : ""}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="mb-3 text-center text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-gray-800 dark:text-white">
                    {selectedLoadScheme.schemeLabel ??
                      selectedLoadScheme.SchemeLabel}
                  </span>
                  {" · "}
                  Select root weeks to copy (sub-topics are included automatically).
                </p>
                <button
                  type="button"
                  className="mb-3 text-sm font-semibold text-brand hover:underline"
                  disabled={isApplyingLoadScheme || loadTopicsLoading}
                  onClick={() => {
                    setSelectedLoadScheme(null);
                    setLoadTopics([]);
                    setSelectedTopicIds([]);
                  }}
                >
                  ← Back to schemes
                </button>
                {loadTopicsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
                  </div>
                ) : loadTopics.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    No root topics found in this scheme.
                  </p>
                ) : (
                  <div className="mb-4 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-3">
                    {loadTopics.map((topic) => {
                      const tid = Number(topic.topicId ?? topic.TopicId);
                      const weekNo = topic.weekNo ?? topic.WeekNo;
                      const title = topic.topicTitle ?? topic.TopicTitle ?? "";
                      const already = Boolean(
                        topic.alreadyInCurrent ?? topic.AlreadyInCurrent
                      );
                      const checked = selectedTopicIds.includes(tid);
                      return (
                        <label
                          key={tid}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg bg-white dark:bg-[#132226] border border-transparent dark:border-white/5 px-3 py-2 text-sm shadow-sm ${
                            already ? "opacity-70" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            disabled={isApplyingLoadScheme}
                            onChange={() => toggleTopicSelection(tid)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              Week{" "}
                              {weekNo != null
                                ? String(weekNo).padStart(2, "0")
                                : "—"}{" "}
                              — {title}
                            </span>
                            {already ? (
                              <span className="mt-0.5 block text-xs text-amber-700 dark:text-amber-400">
                                Already in current outline
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <button
                  type="button"
                  disabled={
                    isApplyingLoadScheme ||
                    loadTopicsLoading ||
                    selectedTopicIds.length === 0
                  }
                  onClick={handleApplyLoadScheme}
                  className="app-btn-primary app-btn-primary-block min-h-[44px] rounded-md py-3 font-extrabold disabled:opacity-50"
                >
                  {isApplyingLoadScheme
                    ? "Applying…"
                    : `Load ${selectedTopicIds.length} topic${selectedTopicIds.length === 1 ? "" : "s"}`}
                </button>
              </>
            )}
          </div>
        </ModalBackdrop>
      )}
    </div>
  );
}

function CloCodePicker({ clos = [], selectedCodes = [], onChange }) {
  const selected = Array.isArray(selectedCodes) ? selectedCodes : [];
  const selectedSet = new Set(selected);

  return (
    <div className="mb-4">
      <AppSelect
        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
        value=""
        emptyLabel="No CLOs uploaded yet"
        onChange={(e) => {
          const code = String(e.target.value || "").trim();
          if (!code || selectedSet.has(code)) return;
          onChange([...selected, code]);
        }}
      >
        <option value="">
          {clos.length ? "Select CLO code" : "No CLOs uploaded yet"}
        </option>
        {clos.map((item) => {
          const code = item.cloCode;
          const picked = selectedSet.has(code);
          const desc = item.cloDescription ? ` — ${item.cloDescription.slice(0, 42)}` : "";
          return (
            <option key={item.cloId || code} value={code} disabled={picked}>
              {code}
              {desc}
              {picked ? " (selected)" : ""}
            </option>
          );
        })}
      </AppSelect>
      {selected.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((code) => (
            <button
              key={code}
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800"
              onClick={() => onChange(selected.filter((item) => item !== code))}
            >
              {code}
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ModalBackdrop({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        {children}
      </div>
    </div>
  );
}

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

function groupTopicsByWeek(topics = []) {
  const map = new Map();
  for (const topic of topics) {
    const weekNo = topic.weekNo != null ? Number(topic.weekNo) : 0;
    if (!map.has(weekNo)) map.set(weekNo, []);
    map.get(weekNo).push(topic);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([weekNo, items]) => ({ weekNo, topics: items }));
}

function getWeekGroupCoverage(topics = []) {
  let doneCount = 0;
  let totalCount = 0;
  for (const topic of topics) {
    const details = getTopicCoverageDetails(topic);
    doneCount += details.doneCount;
    totalCount += details.totalCount;
  }
  if (totalCount === 0) {
    return { status: "pending", label: "Not complete", doneCount: 0, totalCount: 0 };
  }
  if (doneCount === totalCount) {
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

function TopicCompleteCheckbox({
  topic,
  onToggle,
  className = "",
  multiSelectMode = false,
  bulkSelected = false,
}) {
  const covered = isTopicFullyCovered(topic);
  const checked = multiSelectMode ? bulkSelected : covered;
  return (
    <button
      type="button"
      className={`shrink-0 ${className}`.trim()}
      onClick={() => onToggle(topic)}
      aria-label={
        multiSelectMode
          ? bulkSelected
            ? "Deselect topic"
            : "Select topic"
          : covered
            ? "Mark incomplete"
            : "Mark complete"
      }
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
          checked
            ? multiSelectMode
              ? "border-brand bg-brand text-white"
              : "border-emerald-600 bg-emerald-600 text-white"
            : "border-gray-300 bg-white text-transparent"
        }`}
      >
        ✓
      </span>
    </button>
  );
}

/** One Week header, then all topics for that week (no repeated "Week 01 —" on every row). */
function WeekGroup({
  weekNo,
  topics,
  canUpload = false,
  onToggle,
  onAddSubTopic,
  multiSelectMode = false,
  bulkSelectedIds = [],
}) {
  const [expanded, setExpanded] = useState(false);
  const coverage = getWeekGroupCoverage(topics);
  const label = weekNo > 0 ? `Week ${String(weekNo).padStart(2, "0")}` : "Other topics";
  const headerTone =
    coverage.status === "complete"
      ? "border-emerald-200 bg-emerald-50"
      : coverage.status === "partial"
        ? "border-amber-200 bg-amber-50"
        : "border-gray-200 bg-slate-50";
  const statusTone =
    coverage.status === "complete"
      ? "text-emerald-700"
      : coverage.status === "partial"
        ? "text-amber-700"
        : "text-gray-500";

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white ${
        coverage.status === "complete"
          ? "border-emerald-200"
          : coverage.status === "partial"
            ? "border-amber-200"
            : "border-gray-200"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-left ${headerTone}`}
      >
        <div>
          <p className="text-sm font-extrabold text-gray-900">{label}</p>
          <p className={`mt-0.5 text-xs font-semibold ${statusTone}`}>
            {topics.length} topic{topics.length === 1 ? "" : "s"} · {coverage.label}
          </p>
        </div>
        <span className={`inline-block text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}>›</span>
      </button>

      {expanded ? (
        <div>
          {topics.map((topic) => (
            <TopicCard
              key={topic.topicId}
              topic={topic}
              weekNo={weekNo > 0 ? weekNo : Number(topic.weekNo) || 1}
              canUpload={canUpload}
              onToggle={onToggle}
              onAddSubTopic={onAddSubTopic}
              multiSelectMode={multiSelectMode}
              bulkSelectedIds={bulkSelectedIds}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TopicCard({
  topic,
  weekNo,
  canUpload = false,
  onToggle,
  onAddSubTopic,
  multiSelectMode = false,
  bulkSelectedIds = [],
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = (topic.children?.length ?? 0) > 0;
  const subTopicCount = topic.children?.length ?? 0;
  const coverage = getTopicCoverageDetails(topic);
  const bulkSelected = bulkSelectedIds.includes(Number(topic.topicId));
  const rowTone = multiSelectMode && bulkSelected
    ? "bg-brand/5"
    : coverage.status === "complete"
      ? "bg-emerald-50"
      : coverage.status === "partial"
        ? "bg-yellow-50"
        : "bg-white";

  return (
    <div className={`border-b border-gray-200 last:border-b-0 ${rowTone}`}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <TopicCompleteCheckbox
          topic={topic}
          onToggle={onToggle}
          multiSelectMode={multiSelectMode && !hasChildren}
          bulkSelected={bulkSelected}
        />
        <button
          type="button"
          onClick={() => {
            if (hasChildren) setExpanded((v) => !v);
            else onToggle(topic);
          }}
          className="min-w-0 flex-1 text-left"
        >
          <p className="text-sm font-semibold text-gray-900">{topic.topicTitle}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {hasChildren
              ? `${subTopicCount} sub-topic${subTopicCount === 1 ? "" : "s"} · ${coverage.label}`
              : multiSelectMode
                ? bulkSelected
                  ? "Selected"
                  : "Tap to select"
                : coverage.label}
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {canUpload ? (
            <button
              type="button"
              onClick={() => onAddSubTopic(topic.topicId, weekNo, topic.topicTitle)}
              className="text-xs font-semibold text-brand hover:underline"
            >
              Add sub-topic
            </button>
          ) : null}
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="px-1 text-gray-400 hover:text-gray-700"
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse topic" : "Expand topic"}
            >
              <span className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}>›</span>
            </button>
          ) : null}
        </div>
      </div>

      {expanded && hasChildren ? (
        <div
          id={`topic-children-${topic.topicId}`}
          className="border-t border-gray-100 bg-gray-50/60 pl-6 sm:pl-8"
        >
          <div className="ml-2 border-l-2 border-emerald-200/80">
            {topic.children.map((child) => (
              <TopicNode
                key={child.topicId}
                topic={child}
                level={0}
                weekNo={weekNo}
                canUpload={canUpload}
                onToggle={onToggle}
                onAddSubTopic={onAddSubTopic}
                multiSelectMode={multiSelectMode}
                bulkSelectedIds={bulkSelectedIds}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TopicNode({
  topic,
  level,
  weekNo,
  canUpload = false,
  onToggle,
  onAddSubTopic,
  multiSelectMode = false,
  bulkSelectedIds = [],
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = (topic.children?.length ?? 0) > 0;
  const pad = 20 + level * 22;
  const bulkSelected = bulkSelectedIds.includes(Number(topic.topicId));

  return (
    <div>
      <div
        className={`flex items-center gap-3 border-b border-gray-100/80 py-2.5 pr-4 last:border-b-0 ${
          multiSelectMode && bulkSelected ? "bg-brand/5" : ""
        }`}
        style={{ paddingLeft: pad }}
      >
        <TopicCompleteCheckbox
          topic={topic}
          onToggle={onToggle}
          multiSelectMode={multiSelectMode && !hasChildren}
          bulkSelected={bulkSelected}
        />

        <button
          type="button"
          className="min-w-0 flex-1 text-left text-sm text-gray-900"
          onClick={() => {
            if (hasChildren) setExpanded((v) => !v);
            else onToggle(topic);
          }}
        >
          {topic.topicTitle}
          {hasChildren && !expanded ? (
            <span className="ml-2 text-xs text-gray-500">({topic.children.length})</span>
          ) : null}
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {canUpload ? (
            <button
              type="button"
              onClick={() => onAddSubTopic(topic.topicId, weekNo, topic.topicTitle)}
              className="text-xs font-semibold text-brand hover:underline"
            >
              Add
            </button>
          ) : null}
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="px-1 text-gray-400 hover:text-gray-700"
              aria-expanded={expanded}
            >
              <span className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}>›</span>
            </button>
          ) : null}
        </div>
      </div>

      {hasChildren && expanded ? (
        <div id={`topic-children-${topic.topicId}`} className="border-l-2 border-emerald-200/70 ml-5">
          {topic.children.map((child) => (
            <TopicNode
              key={child.topicId}
              topic={child}
              level={level + 1}
              weekNo={weekNo}
              canUpload={canUpload}
              onToggle={onToggle}
              onAddSubTopic={onAddSubTopic}
              multiSelectMode={multiSelectMode}
              bulkSelectedIds={bulkSelectedIds}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
