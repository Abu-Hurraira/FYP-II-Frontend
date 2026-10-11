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
  const [isApplyingTopic, setIsApplyingTopic] = useState(false);
  const [siblingSections, setSiblingSections] = useState([]);
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

  const applyTopicProgress = async (topic, isCompleted, alsoOfferedCourseIds = []) => {
    try {
      setIsApplyingTopic(true);
      const extraIds = (alsoOfferedCourseIds || []).filter(
        (id) => Number(id) > 0 && Number(id) !== Number(offeredCourseId)
      );
      const result = await updateTopicProgress(
        offeredCourseId,
        topic.topicId,
        teacherUserId,
        isCompleted,
        extraIds
      );
      for (const extraId of extraIds) {
        await updateTopicProgress(extraId, topic.topicId, teacherUserId, isCompleted, []);
      }
      setData(result);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setIsApplyingTopic(false);
      setApplyModal(null);
    }
  };

  const handleToggleTopic = async (topic) => {
    const hasChildren = (topic.children?.length ?? 0) > 0;
    if (hasChildren) {
      showAlert(
        "Sub-topics pending",
        "Complete all nested sub-topics before this topic can be marked covered."
      );
      return;
    }
    if (isApplyingTopic) return;

    const nextCompleted = !topic.isCompleted;
    if (siblingSections.length > 0) {
      setSelectedSiblingIds(siblingSections.map((s) => Number(s.offeredCourseId)));
      setApplyModal({ topic, nextCompleted });
      return;
    }

    await applyTopicProgress(topic, nextCompleted);
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
    if (!f.name?.toLowerCase().endsWith(".xlsx")) {
      showAlert("Invalid File", "Please select a .xlsx file.");
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
      showAlert("File", "Please select a .xlsx file.");
      return;
    }
    if (!teacherUserId) {
      showAlert("Error", "Unable to upload. Missing user. Try logging in again.");
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
        {siblingSections.length > 0 && (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            You also teach this subject in{" "}
            <span className="font-semibold">
              {siblingSections.map(siblingLabel).join(", ")}
            </span>
            . When you tick a topic, you can mark those sections from here — no need to open each one.
          </p>
        )}

        {data?.weeks?.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {data.weeks.map((week, index) => (
              <TopicCard
                key={week.topicId}
                topic={week}
                index={index}
                canUpload={canUploadWeeklyContent}
                onToggle={handleToggleTopic}
                onAddSubTopic={openSubTopicModal}
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
              onClick={openLoadSchemeModal}
            >
              Load from Database
            </button>
            <button
              type="button"
              className="app-btn-primary app-btn-primary-block rounded-md py-3 font-bold"
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
            <CloCodePicker
              clos={uploadedCloOptions}
              selectedCodes={cloCodes}
              onChange={setCloCodes}
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
            <CloCodePicker
              clos={uploadedCloOptions}
              selectedCodes={subTopicCloCodes}
              onChange={setSubTopicCloCodes}
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

      {applyModal && (
        <ModalBackdrop
          onClose={() => {
            if (!isApplyingTopic) setApplyModal(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex-1 text-center text-xl font-extrabold">
                {applyModal.nextCompleted ? "Also mark other sections?" : "Also unmark other sections?"}
              </h2>
              <button
                type="button"
                className="text-2xl text-gray-500"
                disabled={isApplyingTopic}
                onClick={() => setApplyModal(null)}
              >
                ×
              </button>
            </div>
            <p className="mb-3 text-center text-sm text-gray-600">
              <span className="font-semibold text-gray-800">{applyModal.topic.topicTitle}</span>
              {" · "}
              {applyModal.nextCompleted ? "Mark complete" : "Mark incomplete"} on this section
              {data?.sectionName ? ` (${data.sectionName})` : ""}. Tick any other sections where you
              taught the same topic.
            </p>
            <div className="mb-4 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3">
              {siblingSections.map((section) => {
                const id = Number(section.offeredCourseId);
                const checked = selectedSiblingIds.includes(id);
                return (
                  <label
                    key={id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm"
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
            <div className="space-y-2">
              <button
                type="button"
                disabled={isApplyingTopic}
                onClick={() =>
                  applyTopicProgress(applyModal.topic, applyModal.nextCompleted, selectedSiblingIds)
                }
                className="app-btn-primary app-btn-primary-block rounded-md py-3 font-extrabold disabled:opacity-50"
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
                onClick={() => applyTopicProgress(applyModal.topic, applyModal.nextCompleted, [])}
                className="w-full rounded-md border border-gray-200 bg-white py-3 text-sm font-extrabold text-gray-700 disabled:opacity-50"
              >
                This section only
              </button>
            </div>
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
              <input type="file" accept=".xlsx" className="hidden" onChange={pickFile} />
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

      {loadSchemeModal && (
        <ModalBackdrop
          onClose={() => {
            if (!isApplyingLoadScheme) closeLoadSchemeModal();
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex-1 text-center text-xl font-extrabold">
                {selectedLoadScheme ? "Select topics" : "Load from previous scheme"}
              </h2>
              <button
                type="button"
                className="text-2xl text-gray-500"
                disabled={isApplyingLoadScheme}
                onClick={closeLoadSchemeModal}
              >
                ×
              </button>
            </div>

            {!selectedLoadScheme ? (
              <>
                <p className="mb-3 text-center text-sm text-gray-500">
                  Choose a previous scheme of study to copy weekly topics from.
                </p>
                {loadSchemesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
                  </div>
                ) : loadSchemes.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-500">
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
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left hover:border-brand hover:bg-brand-muted/20"
                          onClick={() => handleSelectLoadScheme(scheme)}
                        >
                          <p className="text-sm font-bold text-gray-900">{label}</p>
                          <p className="mt-0.5 text-xs text-gray-500">
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
                <p className="mb-3 text-center text-sm text-gray-600">
                  <span className="font-semibold text-gray-800">
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
                  <p className="py-6 text-center text-sm text-gray-500">
                    No root topics found in this scheme.
                  </p>
                ) : (
                  <div className="mb-4 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3">
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
                          className={`flex cursor-pointer items-start gap-3 rounded-lg bg-white px-3 py-2 text-sm shadow-sm ${
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
                            <span className="font-semibold text-gray-900">
                              Week{" "}
                              {weekNo != null
                                ? String(weekNo).padStart(2, "0")
                                : "—"}{" "}
                              — {title}
                            </span>
                            {already ? (
                              <span className="mt-0.5 block text-xs text-amber-700">
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
                  className="app-btn-primary app-btn-primary-block rounded-md py-3 font-extrabold disabled:opacity-50"
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

function TopicCard({ topic, index, canUpload = false, onToggle, onAddSubTopic }) {
  const [expanded, setExpanded] = useState(false);
  const weekNo = topic.weekNo != null ? Number(topic.weekNo) : index + 1;
  const hasChildren = (topic.children?.length ?? 0) > 0;
  const subTopicCount = topic.children?.length ?? 0;
  const coverage = getTopicCoverageDetails(topic);
  const rowTone =
    subTopicCount === 0 || coverage.status === "pending"
      ? "bg-white"
      : coverage.status === "complete"
        ? "bg-emerald-50"
        : "bg-yellow-50";

  return (
    <div className={`border-b border-gray-200 last:border-b-0 ${rowTone}`}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="min-w-0 flex-1 text-left">
          <p className="text-sm font-semibold text-gray-900">
            Week {String(weekNo).padStart(2, "0")} — {topic.topicTitle}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {subTopicCount} sub-topic{subTopicCount === 1 ? "" : "s"} · {coverage.label}
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
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="px-1 text-gray-400 hover:text-gray-700"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse week" : "Expand week"}
          >
            <span className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}>›</span>
          </button>
        </div>
      </div>

      {expanded ? (
        <div id={`week-children-${topic.topicId}`} className="border-t border-gray-100 bg-gray-50/60">
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
            <p className="px-4 py-3 text-sm text-gray-500">
              {canUpload ? "No sub-topics yet. Use Add sub-topic to add one." : "No sub-topics for this week yet."}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function TopicNode({ topic, level, weekNo, canUpload = false, onToggle, onAddSubTopic }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = (topic.children?.length ?? 0) > 0;
  const fullyCovered = isTopicFullyCovered(topic);
  const pad = 16 + level * 18;

  return (
    <div>
      <div
        className="flex items-center gap-3 border-b border-gray-100 py-2.5 pr-4 last:border-b-0"
        style={{ paddingLeft: pad }}
      >
        <button
          type="button"
          className="shrink-0"
          onClick={() => onToggle(topic)}
          aria-label={fullyCovered ? "Mark incomplete" : "Mark complete"}
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
              fullyCovered
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-gray-300 bg-white text-transparent"
            }`}
          >
            ✓
          </span>
        </button>

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
        <div id={`topic-children-${topic.topicId}`}>
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
      ) : null}
    </div>
  );
}
