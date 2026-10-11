import React, { useCallback, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getAssessmentsList,
  createAssessment,
  updateAssessment,
  getAssessmentDetail,
  addAssessmentQuestion,
  updateAssessmentQuestion,
  uploadAssessmentFile,
  parseQuestionPaper,
  getAvailableClos,
  getCourseMenu,
  completeAssessmentSetup,
  reopenAssessmentSetup,
  downloadTeacherFile,
  submitContentForReview,
  getContentStatuses,
  getAssessmentLoadSchemes,
  getAssessmentLoadSchemeItems,
  applyAssessmentLoadScheme,
} from "../../api/teacherApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import AppSelect from "../../components/AppSelect.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";
import PercentInput from "../../components/PercentInput.jsx";
import { getAssessmentUiConfig } from "../../constants/assessmentTypeConfig.js";
import {
  pickContentTypeStatus,
  pickHodFeedback,
} from "../../utils/uploadAllocationHelpers";
import { HodRejectionBanner, useHodRejectionAlert } from "../../components/HodRejectionNotice.jsx";
import { asList } from "../../utils/helpers";

function mapCloMappings(list) {
  return (list || []).map((m) => ({
    cloId: m.cloId ?? m.CloId,
    cloCode: m.cloCode ?? m.CloCode,
    percentage: m.percentage ?? m.Percentage ?? 0,
  }));
}

function mapQuestionDraft(q) {
  const parts = (q.parts ?? q.Parts ?? []).map((p) => ({
    questionId: p.questionId ?? p.QuestionId ?? null,
    questionNo: p.questionNo ?? p.QuestionNo ?? "",
    questionText: p.questionText ?? p.QuestionText ?? "",
    marks: p.marks ?? p.Marks ?? 5,
    cloMappings: mapCloMappings(p.cloMappings ?? p.CloMappings),
  }));
  const stemMarks = q.marks ?? q.Marks;
  return {
    questionId: q.questionId ?? q.QuestionId ?? null,
    questionNo: q.questionNo ?? q.QuestionNo ?? "",
    questionText: q.questionText ?? q.QuestionText ?? "",
    marks: parts.length
      ? parts.reduce((sum, p) => sum + (Number(p.marks) || 0), 0)
      : stemMarks ?? 10,
    cloMappings: mapCloMappings(q.cloMappings ?? q.CloMappings),
    parts,
  };
}

function questionMarks(q) {
  const parts = q?.parts || [];
  if (parts.length > 0) {
    return parts.reduce((sum, p) => sum + (Number(p.marks) || 0), 0);
  }
  return Number(q?.marks) || 0;
}

function cloPercentOnItem(item, cloId) {
  const mapping = item?.cloMappings?.find((m) => Number(m.cloId) === Number(cloId));
  return Number(mapping?.percentage) || 0;
}

function sumDraftCloPercent(questions, cloId, exceptQ = -1, exceptP = -1) {
  return (questions || []).reduce((acc, q, qi) => {
    const parts = q.parts || [];
    if (parts.length > 0) {
      return (
        acc +
        parts.reduce((sum, p, pi) => {
          if (qi === exceptQ && pi === exceptP) return sum;
          return sum + cloPercentOnItem(p, cloId);
        }, 0)
      );
    }
    if (qi === exceptQ && exceptP < 0) return acc;
    return acc + cloPercentOnItem(q, cloId);
  }, 0);
}

function sumSavedCloPercent(detail, cloId) {
  const questions = detail?.questions ?? detail?.Questions ?? [];
  return questions.reduce((acc, q) => {
    const parts = q.parts ?? q.Parts ?? [];
    if (parts.length > 0) {
      return acc + parts.reduce((sum, p) => sum + cloPercentOnItem(mapQuestionDraft(p), cloId), 0);
    }
    return acc + cloPercentOnItem(mapQuestionDraft(q), cloId);
  }, 0);
}

function findQuestionIdByNo(detail, questionNo) {
  const walk = (list) => {
    for (const q of list || []) {
      if (String(q.questionNo ?? q.QuestionNo) === String(questionNo)) {
        return q.questionId ?? q.QuestionId ?? null;
      }
      const hit = walk(q.parts ?? q.Parts ?? []);
      if (hit) return hit;
    }
    return null;
  };
  return walk(detail?.questions ?? detail?.Questions ?? []);
}

function usedOnOtherAssessments(clo, detail) {
  if (!clo) return 0;
  const apiUsed = Number(clo.usedLocalPercent) || 0;
  const savedHere = sumSavedCloPercent(detail, clo.cloId);
  return Math.max(0, Math.round((apiUsed - savedHere) * 100) / 100);
}

function remainingCloPercent(questions, cloId, exceptQ = -1, usedOther = 0, exceptP = -1) {
  const usedHere = sumDraftCloPercent(questions, cloId, exceptQ, exceptP);
  return Math.max(0, Math.round((100 - usedOther - usedHere) * 100) / 100);
}

function normalizeAvailableClos(list) {
  return (list || []).map((c) => ({
    cloId: c.cloId ?? c.CloId,
    cloCode: c.cloCode ?? c.CloCode ?? "",
    description: c.cloDescription ?? c.CloDescription ?? c.description ?? "",
    usedLocalPercent: Number(c.usedLocalPercent ?? c.UsedLocalPercent) || 0,
    remainingLocalPercent: Number(c.remainingLocalPercent ?? c.RemainingLocalPercent ?? 100),
  }));
}

function pickOpenClo(clos, questions, detail) {
  return (
    (clos || []).find((c) => {
      const usedOther = usedOnOtherAssessments(c, detail);
      return remainingCloPercent(questions, c.cloId, -1, usedOther) > 0;
    }) || null
  );
}

function defaultCloMappings(clos, questions, detail) {
  const clo = pickOpenClo(clos, questions, detail);
  if (!clo) return [];
  return [{ cloId: clo.cloId, cloCode: clo.cloCode, percentage: 0 }];
}

function displayAssessmentTitle(item, cfg) {
  const title = String(item?.title ?? item?.Title ?? "").trim();
  if (title) return title;
  const no = item?.assessmentNo ?? item?.AssessmentNo;
  if (no != null && no !== "") return `${cfg.singularTitle} ${no}`;
  return cfg.singularTitle;
}

function pickExamStatusFromAssessments(list, fallback = "Draft") {
  const statuses = (list || []).map((item) =>
    String(item?.contentStatus ?? item?.ContentStatus ?? "").toLowerCase()
  );
  if (statuses.some((s) => s === "pendingreview" || s === "submitted")) return "PendingReview";
  if (statuses.some((s) => s === "rejected")) return "Rejected";
  if (statuses.some((s) => s === "approved") &&
      !statuses.some((s) => s === "draft" || s === "rejected" || s === "pendingreview")) {
    return "Approved";
  }
  return fallback;
}

function examContentTypeCode(variant) {
  if (variant === "Mid") return "MidExam";
  if (variant === "Final") return "FinalExam";
  return null;
}

function HodExamStatusBadge({ statusKey }) {
  if (statusKey === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800 shadow-sm dark:border-emerald-800/40 dark:bg-emerald-950/60 dark:text-emerald-300">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        Status: Approved by HOD
      </span>
    );
  }
  if (statusKey === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-black text-amber-800 shadow-sm dark:border-amber-800/40 dark:bg-amber-950/60 dark:text-amber-300">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
        Status: Pending HOD Review
      </span>
    );
  }
  if (statusKey === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-black text-red-800 shadow-sm dark:border-red-800/40 dark:bg-red-950/60 dark:text-red-300">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        Status: Rejected by HOD
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs font-black text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
      Status: Draft
    </span>
  );
}

export default function TeacherAssignmentsScreen({ variant = "Assignment" }) {
  const cfg = getAssessmentUiConfig(variant);
  const { user } = useContext(AuthContext);
  const { offeredCourseId: ocParam } = useParams();
  const offeredCourseId = Number(ocParam);

  const [searchParams] = useSearchParams();
  const routeTeacher = searchParams.get("teacherUserId");
  const teacherUserId =
    routeTeacher != null && routeTeacher !== ""
      ? Number(routeTeacher) || user?.userId
      : user?.userId;

  const navigate = useNavigate();
  const location = useLocation();
  const isGraderWorkspace = location.pathname.startsWith("/grader");
  const marksBase = isGraderWorkspace ? "/grader" : "/teacher";
  const isExamHodFlow = variant === "Mid" || variant === "Final";
  const examTypeCode = examContentTypeCode(variant);

  const [course, setCourse] = useState(null);
  const [clos, setClos] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [examReview, setExamReview] = useState({
    contentStatus: "Draft",
    hodFeedback: "",
    canSubmit: false,
    blockedReason: "",
    prerequisiteMet: true,
  });
  const [isSubmittingHod, setIsSubmittingHod] = useState(false);

  // Selected assignment for setup/detail view
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(null);
  const [selectedAssessmentDetail, setSelectedAssessmentDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newTotalMarks, setNewTotalMarks] = useState(String(cfg.defaultTotalMarks));
  const [isSubmittingTemplate, setIsSubmittingTemplate] = useState(false);

  // Edit Template state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editTotalMarks, setEditTotalMarks] = useState(String(cfg.defaultTotalMarks));
  const [isUpdatingTemplate, setIsUpdatingTemplate] = useState(false);

  const canManageExam =
    !isExamHodFlow ||
    (variant === "Mid"
      ? Boolean(course?.permissions?.canUploadMidExamQuestions)
      : Boolean(course?.permissions?.canUploadFinalExamQuestions));
  const examStatusKey = String(examReview.contentStatus || "Draft").toLowerCase();
  const isExamApproved = isExamHodFlow && examStatusKey === "approved";
  const isExamPending =
    isExamHodFlow && (examStatusKey === "pendingreview" || examStatusKey === "submitted");
  const isExamRejected = isExamHodFlow && examStatusKey === "rejected";
  const paperLocked = isExamHodFlow && (isExamPending || isExamApproved || !canManageExam);
  const isSetupComplete = Boolean(
    selectedAssessmentDetail?.isSetupComplete ?? selectedAssessmentDetail?.IsSetupComplete
  );
  const canEditPaper = !isSetupComplete && !paperLocked;
  const canReopenSetup = isSetupComplete && !paperLocked;
  const examStatusBadgeKey = isExamApproved
    ? "approved"
    : isExamPending
      ? "pending"
      : isExamRejected
        ? "rejected"
        : "draft";
  const showExamList = !isExamHodFlow || canManageExam || isExamApproved;

  const handleOpenEditModal = () => {
    if (!selectedAssessmentDetail) return;
    if (!canEditPaper) {
      showAlert(
        "Locked",
        paperLocked
          ? "This exam paper is locked. Only the HOD-allocated teacher can edit it before HOD approval."
          : "Reopen setup to edit template details."
      );
      return;
    }
    setEditTitle(selectedAssessmentDetail.title || "");
    setEditDueDate(selectedAssessmentDetail.dueDate || "");
    setEditTotalMarks(String(selectedAssessmentDetail.totalMarks || cfg.defaultTotalMarks));
    setEditModalOpen(true);
  };

  const handleUpdateTemplate = async (e) => {
    e.preventDefault();
    if (cfg.usesCustomTitle && !editTitle.trim()) {
      showAlert("Validation Error", "Title is required.");
      return;
    }
    if (!canEditPaper) {
      showAlert("Locked", "This exam paper cannot be edited right now.");
      return;
    }

    try {
      setIsUpdatingTemplate(true);
      const updated = await updateAssessment(selectedAssessmentId, {
        teacherUserId,
        title: cfg.usesCustomTitle ? editTitle.trim() : (cfg.fixedTitle || editTitle.trim() || cfg.singularTitle),
        dueDate: cfg.usesDueDate ? editDueDate || null : null,
        totalMarks: Number(editTotalMarks) || cfg.defaultTotalMarks,
      });

      setSelectedAssessmentDetail(updated);
      showAlert("Success", "Template details updated successfully.");
      setEditModalOpen(false);
      await loadData();
    } catch (err) {
      showAlert("Error", err.message || "Failed to update template.");
    } finally {
      setIsUpdatingTemplate(false);
    }
  };

  // Question editing state within detail view
  const [questionsDraft, setQuestionsDraft] = useState([]);
  const [isSavingQuestions, setIsSavingQuestions] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState({});

  // File upload state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadPurpose, setUploadPurpose] = useState("Solution");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isParsingPaper, setIsParsingPaper] = useState(false);
  const [isTogglingSetup, setIsTogglingSetup] = useState(false);

  const [loadSchemeModal, setLoadSchemeModal] = useState(false);
  const [loadSchemes, setLoadSchemes] = useState([]);
  const [loadSchemesLoading, setLoadSchemesLoading] = useState(false);
  const [selectedLoadScheme, setSelectedLoadScheme] = useState(null);
  const [loadItems, setLoadItems] = useState([]);
  const [loadItemsLoading, setLoadItemsLoading] = useState(false);
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState([]);
  const [isApplyingLoadScheme, setIsApplyingLoadScheme] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [cData, listData] = await Promise.all([
        getCourseMenu(offeredCourseId, teacherUserId),
        getAssessmentsList(offeredCourseId, teacherUserId, cfg.typeName),
      ]);
      setCourse(cData);
      setAssessments(listData || []);

      if (isExamHodFlow && examTypeCode) {
        const fromList = pickExamStatusFromAssessments(listData);
        setExamReview((prev) => ({
          ...prev,
          contentStatus: fromList,
          canSubmit: (listData || []).some((item) => Number(item.questionCount ?? item.QuestionCount) > 0),
        }));
      }
    } catch (error) {
      showAlert("Error", error.message || cfg.loadError);
    } finally {
      setLoading(false);
    }
  }, [offeredCourseId, teacherUserId, cfg.typeName, cfg.loadError, isExamHodFlow, examTypeCode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isExamHodFlow || !examTypeCode || loading) return;
    if (String(examReview.contentStatus || "").toLowerCase() !== "rejected") return;
    const pCourseId = course?.programCourseId ?? course?.ProgramCourseId;
    if (!pCourseId) return;
    let cancelled = false;
    getContentStatuses(pCourseId, teacherUserId, offeredCourseId)
      .then((statuses) => {
        if (cancelled) return;
        setExamReview((prev) => ({
          ...prev,
          contentStatus: pickContentTypeStatus(statuses, examTypeCode, prev.contentStatus),
          hodFeedback: pickHodFeedback(statuses, examTypeCode),
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [
    isExamHodFlow,
    examTypeCode,
    loading,
    examReview.contentStatus,
    course?.programCourseId,
    teacherUserId,
    offeredCourseId,
  ]);

  useEffect(() => {
    setSelectedAssessmentId(null);
    setSelectedAssessmentDetail(null);
    setQuestionsDraft([]);
    setExpandedQuestions({});
    setAddModalOpen(false);
    setEditModalOpen(false);
    setLoadSchemeModal(false);
    setLoadSchemes([]);
    setSelectedLoadScheme(null);
    setLoadItems([]);
    setSelectedAssessmentIds([]);
    setNewTitle("");
    setNewDueDate("");
    setNewTotalMarks(String(cfg.defaultTotalMarks));
    setEditTotalMarks(String(cfg.defaultTotalMarks));
  }, [variant, cfg.defaultTotalMarks]);

  const toggleExpandQuestion = (index) => {
    setExpandedQuestions((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const loadDetail = useCallback(
    async (assessmentId) => {
      try {
        setLoadingDetail(true);
        const [detail, cloList] = await Promise.all([
          getAssessmentDetail(assessmentId, teacherUserId),
          getAvailableClos(offeredCourseId, teacherUserId, cfg.typeName),
        ]);
        const nextClos = normalizeAvailableClos(cloList);
        setClos(nextClos);
        setSelectedAssessmentDetail(detail);

        // Pre-fill question draft (collapsed by default)
        const questions = detail?.questions ?? detail?.Questions ?? [];
        if (questions.length > 0) {
          setQuestionsDraft(questions.map(mapQuestionDraft));
          setExpandedQuestions({});
        } else if (!isExamHodFlow || (canManageExam && !isExamPending && !isExamApproved)) {
          // Initialize with default Q1 (expanded)
          setQuestionsDraft([
            {
              questionNo: "Q1",
              questionText: "",
              marks: cfg.defaultQuestionMarks,
              cloMappings: defaultCloMappings(nextClos, [], detail),
              parts: [],
            },
          ]);
          setExpandedQuestions({ 0: true });
        } else {
          setQuestionsDraft([]);
          setExpandedQuestions({});
        }
      } catch (error) {
        showAlert("Error", error.message || cfg.detailError);
      } finally {
        setLoadingDetail(false);
      }
    },
    [teacherUserId, offeredCourseId, cfg.typeName, cfg.defaultQuestionMarks, cfg.detailError, isExamHodFlow, canManageExam, isExamPending, isExamApproved]
  );

  const handleSelectAssessment = (assessmentId) => {
    setSelectedAssessmentId(assessmentId);
    loadDetail(assessmentId);
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    const title = cfg.usesCustomTitle
      ? newTitle.trim()
      : (cfg.fixedTitle || newTitle.trim() || cfg.singularTitle);
    if (cfg.usesCustomTitle && !title) {
      showAlert("Validation Error", cfg.requiredTitle);
      return;
    }

    try {
      setIsSubmittingTemplate(true);
      await createAssessment({
        teacherUserId,
        offeredCourseId,
        assessmentTypeName: cfg.typeName,
        title,
        dueDate: cfg.usesDueDate ? newDueDate || null : null,
        totalMarks: Number(newTotalMarks) || cfg.defaultTotalMarks,
      });

      showAlert("Success", cfg.createdMessage);
      setAddModalOpen(false);
      setNewTitle("");
      setNewDueDate("");
      setNewTotalMarks(String(cfg.defaultTotalMarks));
      await loadData();
    } catch (err) {
      showAlert("Error", err.message || cfg.createError);
    } finally {
      setIsSubmittingTemplate(false);
    }
  };

  const closeLoadSchemeModal = () => {
    setLoadSchemeModal(false);
    setLoadSchemes([]);
    setSelectedLoadScheme(null);
    setLoadItems([]);
    setSelectedAssessmentIds([]);
  };

  const openLoadSchemeModal = async () => {
    setLoadSchemeModal(true);
    setSelectedLoadScheme(null);
    setLoadItems([]);
    setSelectedAssessmentIds([]);
    setLoadSchemesLoading(true);
    try {
      const schemes = asList(
        await getAssessmentLoadSchemes(offeredCourseId, teacherUserId, cfg.typeName)
      );
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
    setLoadItemsLoading(true);
    setLoadItems([]);
    setSelectedAssessmentIds([]);
    try {
      const detail = await getAssessmentLoadSchemeItems(
        offeredCourseId,
        sourceSessionId,
        teacherUserId,
        cfg.typeName
      );
      const items = asList(detail?.items ?? detail?.Items);
      setLoadItems(items);
      setSelectedAssessmentIds(
        items
          .map((item) => Number(item.assessmentId ?? item.AssessmentId))
          .filter((id) => Number.isFinite(id) && id > 0)
      );
    } catch (error) {
      showAlert("Error", error.message);
      setSelectedLoadScheme(null);
    } finally {
      setLoadItemsLoading(false);
    }
  };

  const toggleAssessmentSelection = (assessmentId) => {
    const id = Number(assessmentId);
    setSelectedAssessmentIds((prev) =>
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
    if (selectedAssessmentIds.length === 0) {
      showAlert("Validation", `Select at least one ${cfg.singularTitle.toLowerCase()} to load.`);
      return;
    }
    try {
      setIsApplyingLoadScheme(true);
      const result = await applyAssessmentLoadScheme(offeredCourseId, {
        teacherUserId,
        sourceSessionId,
        assessmentIds: selectedAssessmentIds,
        assessmentTypeName: cfg.typeName,
      });
      showAlert(
        "Loaded",
        result?.message ||
          result?.Message ||
          `Loaded ${result?.createdCount ?? result?.CreatedCount ?? selectedAssessmentIds.length} ${cfg.singularTitle.toLowerCase()}(s) from previous scheme.`
      );
      setIsApplyingLoadScheme(false);
      closeLoadSchemeModal();
      await loadData();
    } catch (error) {
      showAlert("Error", error.message);
      setIsApplyingLoadScheme(false);
    }
  };

  const handleAddQuestionRow = () => {
    if (!canEditPaper) {
      showAlert("Locked", "Questions are locked until HOD review is complete, or you are not the allocated teacher.");
      return;
    }
    if (!Number(selectedAssessmentDetail?.totalMarks)) {
      showAlert(
        "Validation Error",
        "Set the assessment total marks using the pencil icon before adding questions."
      );
      return;
    }
    const total = Number(selectedAssessmentDetail.totalMarks);
    const used = questionsDraft.reduce((sum, q) => sum + questionMarks(q), 0);
    const left = Math.max(0, Math.round((total - used) * 100) / 100);
    if (left <= 0) {
      showAlert(
        "Marks complete",
        `All ${total} marks are already used on existing questions. Increase total marks or reduce a question's marks before adding another.`
      );
      return;
    }

    const nextQNo = `Q${questionsDraft.length + 1}`;
    const newIdx = questionsDraft.length;
    setQuestionsDraft((prev) => [
      ...prev,
      {
        questionId: null,
        questionNo: nextQNo,
        questionText: "",
        marks: Math.min(cfg.defaultQuestionMarks, left),
        cloMappings: defaultCloMappings(clos, questionsDraft, selectedAssessmentDetail),
        parts: [],
      },
    ]);
    setExpandedQuestions((prev) => ({ ...prev, [newIdx]: true }));
  };

  const handleAddPart = (qIndex) => {
    if (!canEditPaper) return;
    const current = questionsDraft[qIndex];
    const existingParts = current?.parts || [];
    const total = Number(selectedAssessmentDetail?.totalMarks);
    const hasBudget = Number.isFinite(total) && total > 0;
    if (existingParts.length > 0 && hasBudget) {
      const used = questionsDraft.reduce((sum, item, i) => {
        if (i === qIndex) {
          return sum + existingParts.reduce((s, p) => s + (Number(p.marks) || 0), 0);
        }
        return sum + questionMarks(item);
      }, 0);
      const left = Math.max(0, Math.round((total - used) * 100) / 100);
      if (left <= 0) {
        showAlert(
          "Marks complete",
          "No marks left for another part. Increase total marks or reduce a part's marks first."
        );
        return;
      }
    }

    setQuestionsDraft((prev) => {
      const copy = [...prev];
      const q = { ...copy[qIndex], parts: [...(copy[qIndex].parts || [])] };
      const letter = String.fromCharCode(97 + q.parts.length);
      const firstPart = q.parts.length === 0;
      const usedOthers = prev.reduce((sum, item, i) => (i === qIndex ? sum : sum + questionMarks(item)), 0);
      const partsSum = q.parts.reduce((sum, p) => sum + (Number(p.marks) || 0), 0);
      const left = hasBudget
        ? Math.max(0, Math.round((total - usedOthers - partsSum) * 100) / 100)
        : cfg.defaultQuestionMarks;
      const inherited = firstPart && q.cloMappings?.length
        ? q.cloMappings
        : defaultCloMappings(clos, prev, selectedAssessmentDetail);
      q.parts.push({
        questionId: null,
        questionNo: `${q.questionNo}${letter}`,
        questionText: "",
        marks: firstPart
          ? Number(q.marks) || cfg.defaultQuestionMarks
          : Math.max(1, Math.min(cfg.defaultQuestionMarks, left || cfg.defaultQuestionMarks)),
        cloMappings: inherited,
      });
      q.marks = q.parts.reduce((sum, p) => sum + (Number(p.marks) || 0), 0);
      if (firstPart) q.cloMappings = [];
      copy[qIndex] = q;
      return copy;
    });
    setExpandedQuestions((prev) => ({ ...prev, [qIndex]: true }));
  };

  const handleRemovePart = (qIndex, pIndex) => {
    setQuestionsDraft((prev) => {
      const copy = [...prev];
      const q = { ...copy[qIndex], parts: [...(copy[qIndex].parts || [])] };
      const removed = q.parts[pIndex];
      if (removed?.questionId) return prev;
      q.parts.splice(pIndex, 1);
      q.parts = q.parts.map((p, i) => ({
        ...p,
        questionNo: `${q.questionNo}${String.fromCharCode(97 + i)}`,
      }));
      if (q.parts.length === 0 && removed?.cloMappings?.length) {
        q.cloMappings = removed.cloMappings;
        q.marks = Number(removed.marks) || q.marks;
      } else {
        q.marks = q.parts.reduce((sum, p) => sum + (Number(p.marks) || 0), 0);
      }
      copy[qIndex] = q;
      return copy;
    });
  };

  const handlePartChange = (qIndex, pIndex, field, value) => {
    setQuestionsDraft((prev) => {
      const copy = [...prev];
      const q = { ...copy[qIndex], parts: [...(copy[qIndex].parts || [])] };
      const part = { ...q.parts[pIndex] };
      if (field === "marks") {
        let num = parseFloat(value);
        if (Number.isNaN(num) || num < 0) num = 0;
        const totalMarks = Number(selectedAssessmentDetail?.totalMarks) || 0;
        if (totalMarks > 0) {
          const others = prev.reduce((acc, item, i) => {
            if (i !== qIndex) return acc + questionMarks(item);
            return acc + (item.parts || []).reduce((s, p, pi) => (pi === pIndex ? s : s + (Number(p.marks) || 0)), 0);
          }, 0);
          const maxAllowed = Math.max(0, Math.round((totalMarks - others) * 100) / 100);
          if (num > maxAllowed) num = maxAllowed;
        }
        part.marks = num;
      } else {
        part[field] = value;
      }
      q.parts[pIndex] = part;
      q.marks = q.parts.reduce((sum, p) => sum + (Number(p.marks) || 0), 0);
      copy[qIndex] = q;
      return copy;
    });
  };

  const handlePartCloChange = (qIndex, pIndex, cloId, percentage) => {
    setQuestionsDraft((prev) => {
      const copy = [...prev];
      const q = { ...copy[qIndex], parts: [...(copy[qIndex].parts || [])] };
      const part = { ...q.parts[pIndex] };
      const targetCloId = Number(cloId);
      const selectedClo = clos.find((c) => Number(c.cloId) === targetCloId);
      const maxAllowed = remainingCloPercent(
        prev,
        targetCloId,
        qIndex,
        usedOnOtherAssessments(selectedClo, selectedAssessmentDetail),
        pIndex
      );
      if (percentage === "" || percentage === null || percentage === undefined) {
        part.cloMappings = [
          { cloId: targetCloId, cloCode: selectedClo?.cloCode || `CLO-${targetCloId}`, percentage: "" },
        ];
      } else {
        let num = parseFloat(percentage);
        if (Number.isNaN(num) || num < 0) num = 0;
        if (num > maxAllowed) num = maxAllowed;
        part.cloMappings = [
          { cloId: targetCloId, cloCode: selectedClo?.cloCode || `CLO-${targetCloId}`, percentage: num },
        ];
      }
      q.parts[pIndex] = part;
      copy[qIndex] = q;
      return copy;
    });
  };

  const handleQuestionChange = (index, field, value) => {
    setQuestionsDraft((prev) => {
      const copy = [...prev];
      let val = value;

      if (field === "marks") {
        let num = parseFloat(value);
        if (Number.isNaN(num) || num < 0) num = 0;
        const totalMarks = selectedAssessmentDetail?.totalMarks || cfg.defaultTotalMarks;
        const sumOthers = prev.reduce(
          (acc, q, i) => (i === index ? acc : acc + questionMarks(q)),
          0
        );
        const maxAllowed = Math.max(0, totalMarks - sumOthers);
        if (num > maxAllowed) {
          num = maxAllowed;
          showAlert("Info", `Question marks cannot exceed total assessment marks (${totalMarks}). Capped at ${maxAllowed}.`);
        }
        val = num;
      }

      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleQuestionCloChange = (qIndex, cloId, percentage) => {
    setQuestionsDraft((prev) => {
      const copy = [...prev];
      const targetCloId = Number(cloId);
      const selectedClo = clos.find((c) => Number(c.cloId) === targetCloId);
      const maxAllowed = remainingCloPercent(
        prev,
        targetCloId,
        qIndex,
        usedOnOtherAssessments(selectedClo, selectedAssessmentDetail)
      );

      if (percentage === "" || percentage === null || percentage === undefined) {
        copy[qIndex] = {
          ...copy[qIndex],
          cloMappings: [
            {
              cloId: targetCloId,
              cloCode: selectedClo?.cloCode || `CLO-${targetCloId}`,
              percentage: "",
            },
          ],
        };
        return copy;
      }

      let num = parseFloat(percentage);
      if (Number.isNaN(num) || num < 0) num = 0;
      if (num > maxAllowed) num = maxAllowed;

      copy[qIndex] = {
        ...copy[qIndex],
        cloMappings: [
          {
            cloId: targetCloId,
            cloCode: selectedClo?.cloCode || `CLO-${targetCloId}`,
            percentage: num,
          },
        ],
      };
      return copy;
    });
  };

  const handleSaveQuestions = async () => {
    if (!selectedAssessmentId) return;
    if (!canEditPaper) {
      showAlert("Locked", "Questions cannot be edited while this exam is awaiting or approved by HOD.");
      return;
    }

    if (!Number(selectedAssessmentDetail?.totalMarks)) {
      showAlert(
        "Validation Error",
        "Set the assessment total marks using the pencil icon before saving questions."
      );
      return;
    }

    for (let i = 0; i < questionsDraft.length; i++) {
      const q = questionsDraft[i];
      const parts = q.parts || [];
      if (!String(q.questionText || "").trim()) {
        showAlert("Validation Error", `Question text is required for ${q.questionNo}.`);
        return;
      }
      const gradeable = parts.length > 0 ? parts : [q];
      for (const item of gradeable) {
        if (!String(item.questionText || "").trim()) {
          showAlert("Validation Error", `Question text is required for ${item.questionNo}.`);
          return;
        }
        if (!Number(item.marks) || Number(item.marks) <= 0) {
          showAlert("Validation Error", `Enter marks greater than 0 for ${item.questionNo}.`);
          return;
        }
        if (!item.cloMappings || item.cloMappings.length === 0) {
          showAlert("Validation Error", `Please map a CLO for ${item.questionNo}.`);
          return;
        }
        const pct = Number(item.cloMappings[0]?.percentage);
        if (!Number.isFinite(pct) || pct <= 0) {
          showAlert("Validation Error", `Enter a CLO percentage greater than 0 for ${item.questionNo}.`);
          return;
        }
      }
    }

    const usedByClo = {};
    for (const q of questionsDraft) {
      const items = q.parts?.length ? q.parts : [q];
      for (const item of items) {
        for (const m of item.cloMappings || []) {
          const id = Number(m.cloId);
          usedByClo[id] = (usedByClo[id] || 0) + (Number(m.percentage) || 0);
        }
      }
    }
    for (const c of clos) {
      const usedHere = usedByClo[Number(c.cloId)] || 0;
      const usedOther = usedOnOtherAssessments(c, selectedAssessmentDetail);
      if (usedOther + usedHere > 100.01) {
        showAlert(
          "Validation Error",
          `${c.cloCode} coverage exceeds 100% across all ${cfg.pluralTitle.toLowerCase()} (already used ${usedOther}% on other ${cfg.pluralTitle.toLowerCase()}). Reduce the percentages before saving.`
        );
        return;
      }
    }

    const totalMarksBudget = Number(selectedAssessmentDetail?.totalMarks) || cfg.defaultTotalMarks;
    const marksSum = questionsDraft.reduce((sum, q) => sum + questionMarks(q), 0);
    if (marksSum > totalMarksBudget + 0.01) {
      showAlert(
        "Validation Error",
        `Question marks (${marksSum}) exceed ${cfg.marksNoun} total (${totalMarksBudget}). Reduce marks or increase total marks.`
      );
      return;
    }

    try {
      setIsSavingQuestions(true);
      let latestDetail = selectedAssessmentDetail;
      for (const q of questionsDraft) {
        const hasParts = (q.parts || []).length > 0;
        const stemClo = hasParts
          ? q.parts[0].cloMappings || []
          : q.cloMappings || [];
        const stemPayload = {
          teacherUserId,
          questionNo: q.questionNo,
          questionText: q.questionText,
          marks: hasParts ? Number(q.parts[0]?.marks) || 1 : Number(q.marks) || 10,
          cloMappings: stemClo.map((m) => ({
            cloId: m.cloId,
            percentage: Number(m.percentage) || 0,
          })),
        };
        if (q.questionId) {
          latestDetail = await updateAssessmentQuestion(selectedAssessmentId, q.questionId, stemPayload);
        } else {
          latestDetail = await addAssessmentQuestion(selectedAssessmentId, stemPayload);
        }

        let parentId = q.questionId || findQuestionIdByNo(latestDetail, q.questionNo);
        if (hasParts && !parentId) {
          showAlert("Error", `Could not save parts for ${q.questionNo}. Try saving again.`);
          return;
        }
        for (const part of q.parts || []) {
          const partPayload = {
            teacherUserId,
            parentQuestionId: parentId,
            questionNo: part.questionNo,
            questionText: part.questionText,
            marks: Number(part.marks) || 1,
            cloMappings: (part.cloMappings || []).map((m) => ({
              cloId: m.cloId,
              percentage: Number(m.percentage) || 0,
            })),
          };
          if (part.questionId) {
            latestDetail = await updateAssessmentQuestion(
              selectedAssessmentId,
              part.questionId,
              partPayload
            );
          } else {
            latestDetail = await addAssessmentQuestion(selectedAssessmentId, partPayload);
          }
        }
      }

      showAlert("Saved", cfg.savedQuestionsMessage);
      await loadDetail(selectedAssessmentId);
      await loadData();
    } catch (err) {
      showAlert("Error", err.message || "Failed to save questions.");
    } finally {
      setIsSavingQuestions(false);
    }
  };

  const openUpload = (purpose) => {
    setUploadPurpose(purpose);
    setSelectedFile(null);
    setUploadModalOpen(true);
  };

  const applyParsedPaper = async (assessmentId) => {
    try {
      setIsParsingPaper(true);
      const parsed = await parseQuestionPaper(assessmentId, teacherUserId);
      const incoming = (parsed.questions ?? parsed.Questions ?? []).map(mapQuestionDraft);
      if (incoming.length > 0) {
        setQuestionsDraft(incoming);
        setExpandedQuestions(Object.fromEntries(incoming.map((_, i) => [i, true])));
      }
      showAlert("Paper read", parsed.message ?? parsed.Message ?? "Review the questions and CLO mapping, then save.");
    } catch (err) {
      showAlert("Could not read paper", err.message || "Add questions below.");
    } finally {
      setIsParsingPaper(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !selectedAssessmentId) {
      showAlert("Validation Error", "Please select a file first.");
      return;
    }

    try {
      setIsUploadingFile(true);
      await uploadAssessmentFile(
        selectedAssessmentId,
        teacherUserId,
        uploadPurpose,
        selectedFile
      );

      showAlert("Uploaded", `${uploadPurpose} uploaded successfully.`);
      setUploadModalOpen(false);
      setSelectedFile(null);
      await loadDetail(selectedAssessmentId);
      if (String(uploadPurpose).toLowerCase().includes("question")) {
        await applyParsedPaper(selectedAssessmentId);
      }
    } catch (err) {
      showAlert("Upload Error", err.message || "Failed to upload file.");
    } finally {
      setIsUploadingFile(false);
    }
  };

  const openMarksEntry = () => {
    if (!isSetupComplete) {
      showAlert(
        "Setup required",
        isExamHodFlow
          ? `The mark sheet unlocks after HOD approves this ${cfg.singularTitle.toLowerCase()} (or after you complete setup on your section).`
          : `Finish questions, then tap Complete ${cfg.singularTitle} setup to unlock the mark sheet.`
      );
      return;
    }
    navigate(
      `${marksBase}/course/${offeredCourseId}/assessments/${selectedAssessmentId}/marks?teacherUserId=${teacherUserId ?? ""}`
    );
  };

  const handleCompleteSetup = async () => {
    if (!canEditPaper) {
      showAlert("Locked", "Setup cannot be changed while this exam is locked.");
      return;
    }
    if (!(await showConfirm(`Complete ${cfg.singularTitle} setup?`, "This unlocks the mark sheet. Make sure questions, marks, and CLO mappings are ready."))) {
      return;
    }
    try {
      setIsTogglingSetup(true);
      const updated = await completeAssessmentSetup(selectedAssessmentId, teacherUserId);
      setSelectedAssessmentDetail(updated);
      showAlert("Setup complete", "You can now enter marks from Enter Marks.");
      await loadData();
    } catch (err) {
      showAlert("Cannot complete setup", err.message);
    } finally {
      setIsTogglingSetup(false);
    }
  };

  const handleReopenSetup = async () => {
    if (!canReopenSetup) {
      showAlert(
        "Locked",
        isExamApproved
          ? "HOD has approved this paper. It is locked and shared with other sections."
          : "This exam cannot be reopened right now."
      );
      return;
    }
    if (!(await showConfirm("Reopen setup?", "You can edit questions again. Complete setup when finished."))) {
      return;
    }
    try {
      setIsTogglingSetup(true);
      const updated = await reopenAssessmentSetup(selectedAssessmentId, teacherUserId);
      setSelectedAssessmentDetail(updated);
      await loadDetail(selectedAssessmentId);
    } catch (err) {
      showAlert("Failed", err.message);
    } finally {
      setIsTogglingSetup(false);
    }
  };

  const handleSubmitExamForReview = async () => {
    if (!isExamHodFlow || !examTypeCode) return;
    if (!canManageExam) {
      showAlert("Permission Denied", `Only the HOD-allocated teacher can submit this ${cfg.singularTitle.toLowerCase()} for approval.`);
      return;
    }
    if (isExamPending || isExamApproved) {
      showAlert("Already submitted", isExamApproved ? "This paper is already approved." : "This paper is already awaiting HOD review.");
      return;
    }
    if (examReview.prerequisiteMet === false) {
      showAlert(
        "Prerequisite required",
        examReview.blockedReason || "CLO-Task mapping must be approved before submitting mid/final papers."
      );
      return;
    }
    const hasQuestions = (assessments || []).some(
      (item) => Number(item.questionCount ?? item.QuestionCount) > 0
    );
    if (!hasQuestions) {
      showAlert(
        "Questions required",
        `Save questions on the ${cfg.singularTitle.toLowerCase()} paper first, then upload for HOD.`
      );
      return;
    }

    const programCourseId = course?.programCourseId ?? course?.ProgramCourseId;
    if (!programCourseId) {
      showAlert("Error", "Program course information is missing.");
      return;
    }

    const confirmed = await showConfirm(
      "Submit for HOD Approval",
      `Submit this ${cfg.singularTitle.toLowerCase()} paper to HOD? Once approved, it is copied to every other section of this course. Those teachers can then view the paper, upload their own solutions, and enter marks.`
    );
    if (!confirmed) return;

    try {
      setIsSubmittingHod(true);
      await submitContentForReview(programCourseId, {
        teacherUserId,
        offeredCourseId,
        contentTypeCode: examTypeCode,
      });
      showAlert(
        "Submitted",
        `${cfg.singularTitle} submitted to HOD. You will be notified after review.`
      );
      await loadData();
    } catch (err) {
      showAlert("Error", err.message || `Failed to submit ${cfg.singularTitle.toLowerCase()} for review.`);
    } finally {
      setIsSubmittingHod(false);
    }
  };

  useHodRejectionAlert(
    isExamHodFlow && canManageExam && !loading && isExamRejected,
    `${cfg.singularTitle} exam`,
    examReview.hodFeedback
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-page">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand dark:border-gray-800 dark:border-t-brand" />
      </div>
    );
  }

  const courseTitle = course?.courseTitle || cfg.pluralTitle;

  // Calculate left marks for questions
  const configuredTotalMarks = Number(selectedAssessmentDetail?.totalMarks);
  const hasTotalMarks = Number.isFinite(configuredTotalMarks) && configuredTotalMarks > 0;
  const totalMarks = hasTotalMarks ? configuredTotalMarks : cfg.defaultTotalMarks;
  const questionsMarksSum = questionsDraft.reduce((sum, q) => sum + questionMarks(q), 0);
  const leftForQuestions = hasTotalMarks
    ? Math.max(0, totalMarks - questionsMarksSum)
    : 0;

  const remainingFor = (cloId, exceptIndex = -1, questions = questionsDraft, exceptPart = -1) => {
    const clo = clos.find((c) => Number(c.cloId) === Number(cloId));
    return remainingCloPercent(
      questions,
      cloId,
      exceptIndex,
      usedOnOtherAssessments(clo, selectedAssessmentDetail),
      exceptPart
    );
  };

  const filesForAssessment = selectedAssessmentDetail?.files ?? selectedAssessmentDetail?.Files ?? [];
  const fileByPurpose = (purpose, ...named) =>
    named.find(Boolean) ||
    filesForAssessment.find(
      (f) => (f.filePurpose ?? f.FilePurpose ?? "").toLowerCase() === purpose.toLowerCase()
    );
  const questionPaperFile = fileByPurpose(
    "Question Paper",
    selectedAssessmentDetail?.questionPaperFile,
    selectedAssessmentDetail?.QuestionPaperFile
  );
  const solutionFile = fileByPurpose(
    "Solution",
    selectedAssessmentDetail?.solutionFile,
    selectedAssessmentDetail?.SolutionFile
  );
  const bestSampleFile = fileByPurpose(
    "Best Sample",
    selectedAssessmentDetail?.bestSampleFile,
    selectedAssessmentDetail?.BestSampleFile
  );
  const averageSampleFile = fileByPurpose(
    "Average Sample",
    selectedAssessmentDetail?.averageSampleFile,
    selectedAssessmentDetail?.AverageSampleFile
  );
  const worstSampleFile = fileByPurpose(
    "Worst Sample",
    selectedAssessmentDetail?.worstSampleFile,
    selectedAssessmentDetail?.WorstSampleFile
  );

  const renderUploadCard = (title, purpose, file) => (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a] flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-extrabold text-gray-900 dark:text-white">{title}</h3>
          {file ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              Uploaded
            </span>
          ) : null}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5 truncate">
          {file ? file.fileName ?? file.FileName : "No file uploaded yet"}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => openUpload(purpose)}
          className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-black text-xs px-4 py-2 rounded-xl shadow-sm transition"
        >
          Upload
        </button>
        <button
          type="button"
          onClick={() => {
            if (file?.fileId || file?.FileId) {
              downloadTeacherFile(
                file.fileId ?? file.FileId,
                offeredCourseId,
                file.fileName ?? file.FileName
              ).catch((err) => showAlert("Download Error", err.message));
            } else {
              showAlert("Info", `No ${title.toLowerCase()} uploaded yet.`);
            }
          }}
          className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-extrabold text-xs px-4 py-2 rounded-xl transition"
        >
          Download
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-full bg-page pb-12">
      {/* Standard Header Bar */}
      <div className="border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8 dark:border-[#1b2c2e] dark:bg-[#071113]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {selectedAssessmentId ? (
              <button
                type="button"
                onClick={() => setSelectedAssessmentId(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200 font-extrabold"
              >
                ‹
              </button>
            ) : (
              <PageBackButton className="mt-0.5 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-semibold text-gray-900 dark:text-white">
                {selectedAssessmentId
                  ? displayAssessmentTitle(selectedAssessmentDetail, cfg)
                  : cfg.pluralTitle}
              </h1>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {courseTitle}
              </p>
            </div>
          </div>
          {isExamHodFlow ? (
            <div className="flex flex-wrap items-center gap-2">
              <HodExamStatusBadge statusKey={examStatusBadgeKey} />
              {canManageExam && !isExamPending && !isExamApproved && !selectedAssessmentId ? (
                <button
                  type="button"
                  onClick={handleSubmitExamForReview}
                  disabled={isSubmittingHod}
                  className="h-9 rounded-xl bg-[#15803d] px-3 text-xs font-extrabold text-white shadow-sm disabled:opacity-50"
                >
                  {isSubmittingHod ? "Uploading…" : "Upload for HOD"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8 space-y-4">
        {/* VIEW 1: ASSIGNMENTS LIST (Image 3) */}
        {!selectedAssessmentId && (
          <div className="space-y-4 max-w-2xl mx-auto">
            {isExamHodFlow && canManageExam && isExamRejected ? (
              <HodRejectionBanner title={`${cfg.singularTitle.toLowerCase()} exam`} reason={examReview.hodFeedback} />
            ) : isExamHodFlow && canManageExam && isExamPending ? (
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 p-4 text-xs sm:text-sm font-medium text-amber-900 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300">
                Submitted to HOD. The paper is locked until the HOD approves or rejects it.
              </div>
            ) : isExamHodFlow && isExamApproved ? (
              <div className="rounded-2xl border border-emerald-800/20 bg-[#f4fbf7] p-4 text-xs sm:text-sm font-medium text-[#15803d] shadow-sm dark:bg-[#091816] dark:text-emerald-300 dark:border-emerald-800/30">
                Approved by HOD and shared with other sections of this course. Questions are locked. Each section uploads its own solution/samples and enters marks.
              </div>
            ) : isExamHodFlow && canManageExam ? (
              <div className="rounded-2xl border border-emerald-800/20 bg-[#f4fbf7] p-4 text-xs sm:text-sm font-bold text-[#15803d] shadow-sm dark:bg-[#091816] dark:text-emerald-300 dark:border-emerald-800/30">
                1) Set total marks and save questions. 2) Click <strong>Upload for HOD</strong>. After HOD approves, this paper is copied to every other section of this course.
              </div>
            ) : isExamHodFlow ? (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/80 p-4 text-xs sm:text-sm font-medium text-blue-900 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200">
                Waiting for HOD to approve the {cfg.singularTitle.toLowerCase()} paper from the allocated teacher. After approval it appears here for every section of this course.
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-800/20 bg-[#f4fbf7] p-4 text-xs sm:text-sm font-bold text-[#15803d] shadow-sm dark:bg-[#091816] dark:text-emerald-300 dark:border-emerald-800/30">
                {cfg.listBanner}
              </div>
            )}

            {isExamHodFlow && !canManageExam && !isExamApproved ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center shadow-card dark:border-[#1b2c2e] dark:bg-[#0c181a]">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Waiting for HOD to approve the {cfg.singularTitle.toLowerCase()} paper from the allocated teacher.
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  It will appear here for every section of this course after approval.
                </p>
              </div>
            ) : null}

            {/* List of Assignment Cards */}
            {showExamList ? (
            <div className="space-y-3">
              {assessments.map((item) => {
                const isCompleted = item.questionCount > 0;
                const isRequired = item.isRequired;

                return (
                  <div
                    key={item.assessmentId}
                    onClick={() => handleSelectAssessment(item.assessmentId)}
                    className="group cursor-pointer rounded-2xl border border-gray-100 bg-white p-4 shadow-card shadow-sm transition hover:border-emerald-500/30 hover:bg-brand-muted/20 dark:border-[#1b2c2e] dark:bg-[#0c181a] dark:hover:border-emerald-500/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-extrabold text-gray-900 dark:text-white group-hover:text-[#15803d] dark:group-hover:text-[#34d399]">
                          {displayAssessmentTitle(item, cfg)}
                        </h3>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
                          {item.dueDate ? `Due ${item.dueDate} · ` : ""}
                          {item.totalMarks != null ? `${item.totalMarks} marks` : "Set total marks"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {isRequired && (
                          <span className="bg-[#fef3c7] text-[#92400e] dark:bg-[#38260d] dark:text-[#fcd34d] text-xs font-black px-3 py-1 rounded-full shadow-xs">
                            Required
                          </span>
                        )}
                        {isCompleted ? (
                          <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-black px-3 py-1 rounded-lg">
                            Completed
                          </span>
                        ) : item.isEmpty ? (
                          <span className="text-red-600 font-extrabold text-xs px-2 py-1">
                            Empty
                          </span>
                        ) : (
                          <span className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 text-xs font-black px-3 py-1 rounded-lg">
                            Set up
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            ) : null}

            {!isGraderWorkspace && (!cfg.hideAddTemplate || (isExamHodFlow && canManageExam)) && (
            <div className="flex flex-wrap items-center pt-4 gap-3">
              {!cfg.hideAddTemplate && (
              <button
                type="button"
                onClick={() => {
                  setNewTitle(cfg.usesCustomTitle ? "" : cfg.fixedTitle || "");
                  setNewDueDate("");
                  setNewTotalMarks(String(cfg.defaultTotalMarks));
                  setAddModalOpen(true);
                }}
                className="bg-[#15803d] hover:bg-[#166534] text-white font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-2xl shadow-md transition active:scale-95 flex-1"
              >
                {cfg.addButton}
              </button>
              )}
              {(!isExamHodFlow || canManageExam) && (
              <button
                type="button"
                onClick={openLoadSchemeModal}
                className="border border-emerald-700/30 bg-white hover:bg-emerald-50 text-[#15803d] font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-2xl shadow-sm transition active:scale-95 flex-1 dark:bg-[#0c181a] dark:text-emerald-300 dark:border-emerald-800/40 dark:hover:bg-[#091816]"
              >
                Load from previous scheme
              </button>
              )}
            </div>
            )}
          </div>
        )}

        {/* VIEW 2: ASSIGNMENT SETUP / DETAIL (Image 1) */}
        {selectedAssessmentId && (
          <div className="space-y-4 max-w-2xl mx-auto">
            {isExamHodFlow && canManageExam && isExamRejected ? (
              <HodRejectionBanner title={`${cfg.singularTitle.toLowerCase()} exam`} reason={examReview.hodFeedback} />
            ) : isExamHodFlow && canManageExam && isExamPending ? (
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 p-4 text-xs sm:text-sm font-medium text-amber-900 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300">
                Submitted to HOD. Question editing is locked until review.
              </div>
            ) : isExamHodFlow && isExamApproved ? (
              <div className="rounded-2xl border border-emerald-800/20 bg-[#f4fbf7] p-4 text-xs sm:text-sm font-medium text-[#15803d] shadow-sm dark:bg-[#091816] dark:text-emerald-300 dark:border-emerald-800/30">
                Approved paper. Questions are locked. Upload your section’s solution/samples and enter marks.
              </div>
            ) : null}
            {loadingDetail ? (
              <div className="flex min-h-[30vh] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
              </div>
            ) : (
              <>
                {!isGraderWorkspace && (
                  <>
                    {renderUploadCard("Question Paper", "Question Paper", questionPaperFile)}
                    {renderUploadCard(cfg.solutionLabel || "Solution", "Solution", solutionFile)}
                    {renderUploadCard("Best Sample", "Best Sample", bestSampleFile)}
                    {renderUploadCard("Average Sample", "Average Sample", averageSampleFile)}
                    {renderUploadCard("Worst Sample", "Worst Sample", worstSampleFile)}
                  </>
                )}

                {/* Card 3: Enter Marks */}
                <div
                  onClick={openMarksEntry}
                  className="cursor-pointer rounded-2xl border border-gray-100 bg-white p-4 shadow-card shadow-sm transition hover:border-emerald-500/30 dark:border-[#1b2c2e] dark:bg-[#0c181a] flex items-center justify-between"
                >
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                      Enter Marks
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                      Student scores per question
                    </p>
                  </div>
                  <span className="text-xl font-bold text-gray-400">›</span>
                </div>

                {/* Card 4: Questions & CLO Mapping */}
                {!isGraderWorkspace && (
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a] space-y-4">
                  {canEditPaper ? (
                    <button
                      type="button"
                      disabled={isParsingPaper}
                      onClick={() => applyParsedPaper(selectedAssessmentId)}
                      className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50"
                    >
                      {isParsingPaper ? "Reading paper…" : "Read questions from uploaded paper"}
                    </button>
                  ) : null}
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1b2c2e] pb-3">
                    <div>
                      <h3 className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>{displayAssessmentTitle(selectedAssessmentDetail, cfg)}</span>
                        <button
                          type="button"
                          onClick={handleOpenEditModal}
                          disabled={!canEditPaper}
                          title={
                            !canEditPaper
                              ? paperLocked
                                ? "Paper is locked for HOD review or you are not the allocated teacher"
                                : "Reopen setup to edit template"
                              : cfg.usesDueDate
                                ? "Edit template title, due date & marks"
                                : "Edit total marks"
                          }
                          className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-200 flex items-center justify-center text-xs transition"
                        >
                          ✎
                        </button>
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                        {selectedAssessmentDetail?.dueDate ? `Due ${selectedAssessmentDetail.dueDate} · ` : ""}
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                          {hasTotalMarks
                            ? `${totalMarks} marks · ${leftForQuestions} left for questions`
                            : "Set total marks with the pencil before adding questions"}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Remaining CLOs Budget Banner */}
                  {clos.length > 0 && (
                    <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-3 dark:border-emerald-800/30 dark:bg-[#091816] space-y-1.5">
                      <p className="text-xs font-black uppercase tracking-wider text-[#15803d] dark:text-[#34d399]">
                        Remaining CLO Coverage Budget (all {cfg.pluralTitle})
                      </p>
                      <p className="text-[11px] font-medium text-emerald-900/70 dark:text-emerald-200/70">
                        Each CLO can use 100% across every {cfg.singularTitle.toLowerCase()}. This {cfg.singularTitle.toLowerCase()} plus the others must add up to 100%.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {clos.map((c) => {
                          const rem = remainingFor(c.cloId);
                          const usedHere = Math.round(sumDraftCloPercent(questionsDraft, c.cloId) * 100) / 100;
                          const usedOther = usedOnOtherAssessments(c, selectedAssessmentDetail);
                          return (
                            <span
                              key={c.cloId}
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-black border ${
                                rem === 0
                                  ? "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                                  : rem > 0
                                  ? "bg-white text-emerald-800 border-emerald-300 dark:bg-[#122427] dark:text-emerald-300 dark:border-emerald-800/50"
                                  : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300"
                              }`}
                              title={`This ${cfg.singularTitle.toLowerCase()} ${usedHere}% · other ${cfg.pluralTitle.toLowerCase()} ${usedOther}% · left ${rem}%`}
                            >
                              {c.cloCode}: {rem}% left
                              <span className="font-semibold opacity-70">
                                (this {usedHere}% · others {usedOther}%)
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="text-sm font-extrabold text-emerald-800 dark:text-emerald-300">
                      Questions
                    </h4>

                    {questionsDraft.map((q, idx) => {
                      const isExpanded = Boolean(expandedQuestions[idx]);
                      const hasParts = (q.parts || []).length > 0;
                      const primaryClo = q.cloMappings?.[0];
                      const selectedCloId = primaryClo?.cloId || (clos[0]?.cloId ?? "");
                      const cloRemaining = remainingFor(selectedCloId, idx);
                      const currentPct = primaryClo?.percentage;
                      const partCloBadges = hasParts
                        ? (q.parts || []).map((p) => ({
                            no: p.questionNo,
                            clo: p.cloMappings?.[0],
                          }))
                        : [];

                      return (
                        <div
                          key={idx}
                          className="rounded-xl border border-gray-100 bg-[#f9fafb] dark:bg-[#091517] dark:border-[#1b2c2e] overflow-visible transition-all shadow-xs"
                        >
                          {/* Collapsible Card Header */}
                          <div
                            onClick={() => toggleExpandQuestion(idx)}
                            className="flex items-center justify-between px-4 py-3 cursor-pointer bg-white hover:bg-gray-50/80 dark:bg-[#0c181a] dark:hover:bg-[#112225] transition"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className="shrink-0 text-sm font-black text-gray-900 dark:text-white">
                                {q.questionNo}
                              </span>
                              <p className="truncate text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-300">
                                {q.questionText ? q.questionText : <span className="italic text-gray-400">No question text entered</span>}
                              </p>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0 ml-3">
                              <span className="bg-[#15803d]/10 text-[#15803d] dark:bg-emerald-950 dark:text-emerald-300 text-xs font-black px-2.5 py-0.5 rounded-full">
                                {questionMarks(q) || 0} Marks
                              </span>

                              {hasParts ? (
                                <>
                                  <span className="bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-200 text-xs font-black px-2.5 py-0.5 rounded-full border border-violet-200/60 dark:border-violet-800/40">
                                    {q.parts.length} part{q.parts.length === 1 ? "" : "s"}
                                  </span>
                                  {partCloBadges.some((b) => b.clo) ? (
                                    partCloBadges.map((b) =>
                                      b.clo ? (
                                        <span
                                          key={b.no}
                                          className="bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200 text-xs font-black px-2.5 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/40"
                                        >
                                          {b.no} {b.clo.cloCode} ({b.clo.percentage}%)
                                        </span>
                                      ) : null
                                    )
                                  ) : (
                                    <span className="bg-amber-50 text-amber-800 text-xs font-extrabold px-2 py-0.5 rounded-full border border-amber-200">
                                      Unmapped
                                    </span>
                                  )}
                                </>
                              ) : primaryClo ? (
                                <span className="bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200 text-xs font-black px-2.5 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/40">
                                  {primaryClo.cloCode} ({primaryClo.percentage}%)
                                </span>
                              ) : (
                                <span className="bg-amber-50 text-amber-800 text-xs font-extrabold px-2 py-0.5 rounded-full border border-amber-200">
                                  Unmapped
                                </span>
                              )}

                              <span className="text-xs font-black text-gray-400 dark:text-gray-500 w-4 text-center">
                                {isExpanded ? "▲" : "▼"}
                              </span>
                            </div>
                          </div>

                          {/* Expanded Form Fields */}
                          {isExpanded && (
                            <div className="p-3.5 border-t border-gray-100 dark:border-[#1b2c2e] space-y-3 bg-[#f9fafb] dark:bg-[#091517]">
                              <div>
                                <textarea
                                  rows={2}
                                  value={q.questionText}
                                  disabled={!canEditPaper}
                                  onChange={(e) => handleQuestionChange(idx, "questionText", e.target.value)}
                                  placeholder="Enter question text..."
                                  className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs sm:text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                                />
                              </div>

                              <div className="flex items-center gap-3">
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                  Marks
                                </label>
                                {hasParts ? (
                                  <span className="text-xs font-black text-gray-800 dark:text-gray-200">
                                    {questionMarks(q)}
                                    <span className="ml-1.5 font-semibold text-gray-500">
                                      (sum of parts)
                                    </span>
                                  </span>
                                ) : (
                                  <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    placeholder="e.g. 5"
                                    value={q.marks}
                                    disabled={!canEditPaper}
                                    onChange={(e) => handleQuestionChange(idx, "marks", e.target.value)}
                                    className="w-20 rounded-lg border border-gray-200 bg-white py-1 px-2 text-xs sm:text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                                  />
                                )}
                              </div>

                              {!hasParts && (
                              <div className="rounded-lg bg-emerald-50/70 border border-emerald-200/60 p-2.5 dark:bg-[#0f241f] dark:border-emerald-800/30 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-[#15803d] dark:text-[#34d399]">
                                    Map CLO
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <AppSelect
                                    value={selectedCloId}
                                    onChange={(e) => {
                                      const nextCloId = e.target.value;
                                      const rem = remainingFor(nextCloId, idx);
                                      const current = Number(q.cloMappings?.[0]?.percentage) || 0;
                                      handleQuestionCloChange(idx, nextCloId, Math.min(current, rem));
                                    }}
                                    className="flex-1 rounded-lg border border-gray-200 bg-white py-1.5 px-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                                  >
                                    {clos.map((c) => {
                                      const remOverall = remainingFor(c.cloId);
                                      return (
                                        <option
                                          key={c.cloId}
                                          value={c.cloId}
                                          disabled={
                                            remOverall <= 0 && Number(selectedCloId) !== Number(c.cloId)
                                          }
                                        >
                                          {c.cloCode} ({remOverall}% left)
                                          {c.description ? ` - ${c.description.substring(0, 20)}` : ""}
                                        </option>
                                      );
                                    })}
                                  </AppSelect>

                                  <PercentInput
                                    min={0}
                                    max={cloRemaining}
                                    value={
                                      currentPct === "" || currentPct == null
                                        ? ""
                                        : Math.min(Number(currentPct) || 0, cloRemaining)
                                    }
                                    onChange={(next) => handleQuestionCloChange(idx, selectedCloId, next)}
                                    title={`Coverage remaining: ${cloRemaining}%`}
                                    className="w-16 rounded-lg border border-gray-200 bg-white py-1.5 px-1 text-center text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                                  />
                                  <span className="text-xs font-bold text-gray-500">%</span>
                                </div>
                              </div>
                              )}

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-gray-700 dark:text-gray-300">
                                    Question parts
                                  </span>
                                  {canEditPaper && (
                                    <button
                                      type="button"
                                      onClick={() => handleAddPart(idx)}
                                      className="rounded-lg bg-white px-2.5 py-1 text-xs font-extrabold text-[#15803d] border border-emerald-200 hover:bg-emerald-50 dark:bg-[#122427] dark:border-emerald-800/40 dark:text-emerald-300"
                                    >
                                      + Add part
                                    </button>
                                  )}
                                </div>

                                {hasParts &&
                                  q.parts.map((part, pIdx) => {
                                    const partClo = part.cloMappings?.[0];
                                    const partCloId = partClo?.cloId || (clos[0]?.cloId ?? "");
                                    const partRemaining = remainingFor(partCloId, idx, questionsDraft, pIdx);
                                    const partPct = partClo?.percentage;
                                    return (
                                      <div
                                        key={`${part.questionNo}-${pIdx}`}
                                        className="rounded-xl border border-violet-200/70 bg-white p-2.5 space-y-2 dark:border-violet-800/40 dark:bg-[#101820]"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-black text-violet-800 dark:text-violet-200">
                                            {part.questionNo}
                                          </span>
                                          {canEditPaper && !part.questionId && (
                                            <button
                                              type="button"
                                              onClick={() => handleRemovePart(idx, pIdx)}
                                              className="text-xs font-extrabold text-red-600 hover:text-red-700"
                                            >
                                              Remove
                                            </button>
                                          )}
                                        </div>
                                        <textarea
                                          rows={2}
                                          value={part.questionText}
                                          disabled={!canEditPaper}
                                          onChange={(e) =>
                                            handlePartChange(idx, pIdx, "questionText", e.target.value)
                                          }
                                          placeholder={`Enter ${part.questionNo} text...`}
                                          className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs sm:text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                                        />
                                        <div className="flex items-center gap-3">
                                          <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                            Marks
                                          </label>
                                          <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={part.marks}
                                            disabled={!canEditPaper}
                                            onChange={(e) =>
                                              handlePartChange(idx, pIdx, "marks", e.target.value)
                                            }
                                            className="w-20 rounded-lg border border-gray-200 bg-white py-1 px-2 text-xs sm:text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                                          />
                                        </div>
                                        <div className="rounded-lg bg-emerald-50/70 border border-emerald-200/60 p-2.5 dark:bg-[#0f241f] dark:border-emerald-800/30 space-y-2">
                                          <span className="text-xs font-black text-[#15803d] dark:text-[#34d399]">
                                            Map CLO
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <AppSelect
                                              value={partCloId}
                                              disabled={!canEditPaper}
                                              onChange={(e) => {
                                                const nextCloId = e.target.value;
                                                const rem = remainingFor(nextCloId, idx, questionsDraft, pIdx);
                                                const current = Number(part.cloMappings?.[0]?.percentage) || 0;
                                                handlePartCloChange(idx, pIdx, nextCloId, Math.min(current, rem));
                                              }}
                                              className="flex-1 rounded-lg border border-gray-200 bg-white py-1.5 px-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                                            >
                                              {clos.map((c) => {
                                                const remOverall = remainingFor(c.cloId, idx, questionsDraft, pIdx);
                                                return (
                                                  <option
                                                    key={c.cloId}
                                                    value={c.cloId}
                                                    disabled={
                                                      remOverall <= 0 && Number(partCloId) !== Number(c.cloId)
                                                    }
                                                  >
                                                    {c.cloCode} ({remOverall}% left)
                                                    {c.description ? ` - ${c.description.substring(0, 20)}` : ""}
                                                  </option>
                                                );
                                              })}
                                            </AppSelect>
                                            <PercentInput
                                              min={0}
                                              max={partRemaining}
                                              disabled={!canEditPaper}
                                              value={
                                                partPct === "" || partPct == null
                                                  ? ""
                                                  : Math.min(Number(partPct) || 0, partRemaining)
                                              }
                                              onChange={(next) => handlePartCloChange(idx, pIdx, partCloId, next)}
                                              title={`Coverage remaining: ${partRemaining}%`}
                                              className="w-16 rounded-lg border border-gray-200 bg-white py-1.5 px-1 text-center text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                                            />
                                            <span className="text-xs font-bold text-gray-500">%</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {canEditPaper ? (
                      <>
                    <button
                      type="button"
                      onClick={handleAddQuestionRow}
                      disabled={leftForQuestions <= 0}
                      className="w-full py-2.5 rounded-xl border border-dashed border-emerald-600/40 text-[#15803d] dark:text-[#34d399] font-extrabold text-xs hover:bg-emerald-50/50 dark:hover:bg-[#0f241f] transition disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {!hasTotalMarks
                        ? "Set total marks first — then add questions"
                        : leftForQuestions <= 0
                        ? "All marks used — cannot add another question"
                        : "+ Add Question"}
                    </button>
                  <div className="pt-2 space-y-2">
                    <button
                      type="button"
                      onClick={handleSaveQuestions}
                      disabled={isSavingQuestions}
                      className="w-full bg-[#15803d] hover:bg-[#166534] text-white font-extrabold text-sm py-3 rounded-2xl shadow-md transition disabled:opacity-50"
                    >
                      {isSavingQuestions ? "Saving Questions…" : cfg.saveQuestionsLabel}
                    </button>
                    {isExamHodFlow && canManageExam ? (
                      <button
                        type="button"
                        onClick={handleSubmitExamForReview}
                        disabled={isSubmittingHod}
                        className="w-full rounded-2xl bg-[#14532d] py-3 text-sm font-extrabold text-white disabled:opacity-50"
                      >
                        {isSubmittingHod ? "Uploading…" : "Upload for HOD"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleCompleteSetup}
                      disabled={isTogglingSetup}
                      className="w-full rounded-2xl border border-emerald-300 bg-white py-3 text-sm font-extrabold text-emerald-800 disabled:opacity-50 dark:bg-[#0c181a] dark:text-emerald-300"
                    >
                      {isTogglingSetup ? "Please wait…" : `Complete ${cfg.singularTitle} setup`}
                    </button>
                  </div>
                      </>
                    ) : (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800/40 dark:bg-[#091816]">
                        <p className="text-sm font-black text-emerald-800 dark:text-emerald-300">
                          {isExamPending
                            ? "Awaiting HOD review"
                            : isExamApproved
                              ? "Approved by HOD"
                              : isSetupComplete
                                ? "Setup complete"
                                : "View only"}
                        </p>
                        <p className="mt-1 text-xs font-medium text-emerald-900/80">
                          {isExamPending
                            ? "Questions are locked until the HOD approves or rejects this paper."
                            : isExamApproved
                              ? "Questions are locked and shared with other sections. Use Enter Marks and upload your section’s files."
                              : isSetupComplete
                                ? "Questions are locked. Use Enter Marks, or reopen setup to edit."
                                : "The allocated teacher designs this paper. After HOD approval it will appear here for your section."}
                        </p>
                        {canReopenSetup ? (
                          <button
                            type="button"
                            disabled={isTogglingSetup}
                            onClick={handleReopenSetup}
                            className="mt-3 w-full rounded-xl border border-emerald-300 bg-white py-2 text-xs font-extrabold text-emerald-800 disabled:opacity-50"
                          >
                            {isTogglingSetup ? "Please wait…" : "Reopen setup"}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
                )}

              </>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: ADD ASSIGNMENT TEMPLATE (Image 2) */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#0c181a] border border-gray-100 dark:border-[#1b2c2e] space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white">
                  {cfg.addModalTitle}
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                  {cfg.addModalHint}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-4 pt-2">
              {cfg.usesCustomTitle && (
              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                  {cfg.titleLabel}
                </label>
                <input
                  type="text"
                  required
                  placeholder={cfg.titlePlaceholder}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 p-3 text-xs sm:text-sm font-semibold text-gray-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                />
              </div>
              )}

              {cfg.usesDueDate && (
              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 p-3 text-xs sm:text-sm font-semibold text-gray-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                />
              </div>
              )}

              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                  Total Marks
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  required
                  placeholder={`e.g. ${cfg.defaultTotalMarks}`}
                  value={newTotalMarks}
                  onChange={(e) => setNewTotalMarks(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 p-3 text-xs sm:text-sm font-semibold text-gray-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingTemplate}
                  className="w-full bg-[#15803d] hover:bg-[#166534] text-white font-black py-3.5 rounded-2xl text-sm shadow-md transition disabled:opacity-50"
                >
                  {isSubmittingTemplate ? "Saving…" : cfg.saveTemplateLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: UPLOAD FILE (Solution / Sample) */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#0c181a] border border-gray-100 dark:border-[#1b2c2e] space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white">
                  Upload {uploadPurpose}
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Any file format is allowed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                  Select File
                </label>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs font-semibold text-gray-600 dark:text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-emerald-100 file:text-[#15803d] hover:file:bg-emerald-200"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 dark:border-gray-800 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFileUpload}
                  disabled={isUploadingFile || !selectedFile}
                  className="bg-[#15803d] hover:bg-[#166534] text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow transition disabled:opacity-50"
                >
                  {isUploadingFile ? "Uploading…" : "Upload File"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#0c181a] border border-gray-100 dark:border-[#1b2c2e]">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Edit Template Details
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {cfg.usesDueDate
                ? "Update template title, due date, and total marks."
                : "Update total marks for this exam."}
            </p>

            <form onSubmit={handleUpdateTemplate} className="mt-5 space-y-4">
              {cfg.usesCustomTitle && (
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder={cfg.titlePlaceholder}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white font-medium"
                />
              </div>
              )}

              {cfg.usesDueDate && (
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white font-medium"
                />
              </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Total Marks
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  required
                  placeholder={`e.g. ${cfg.defaultTotalMarks}`}
                  value={editTotalMarks}
                  onChange={(e) => setEditTotalMarks(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white font-medium"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingTemplate}
                  className="bg-[#15803d] hover:bg-[#166534] text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {isUpdatingTemplate ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loadSchemeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => {
            if (!isApplyingLoadScheme) closeLoadSchemeModal();
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#0c181a] border border-gray-100 dark:border-[#1b2c2e] space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white">
                  {selectedLoadScheme
                    ? `Select ${cfg.pluralTitle.toLowerCase()}`
                    : "Load from previous scheme"}
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                  {selectedLoadScheme
                    ? `Pick which ${cfg.pluralTitle.toLowerCase()} to copy into this section.`
                    : `Choose a previous scheme of study that has ${cfg.pluralTitle.toLowerCase()} for this subject.`}
                </p>
              </div>
              <button
                type="button"
                disabled={isApplyingLoadScheme}
                onClick={closeLoadSchemeModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {!selectedLoadScheme ? (
              loadSchemesLoading ? (
                <div className="flex justify-center py-10">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
                </div>
              ) : loadSchemes.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No previous schemes with {cfg.pluralTitle.toLowerCase()} were found.
                </p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {loadSchemes.map((scheme) => {
                    const sid = Number(scheme.sessionId ?? scheme.SessionId);
                    const label =
                      scheme.schemeLabel ?? scheme.SchemeLabel ?? `Scheme ${sid}`;
                    const year = scheme.academicYear ?? scheme.AcademicYear;
                    const count = scheme.assessmentCount ?? scheme.AssessmentCount;
                    return (
                      <button
                        key={sid}
                        type="button"
                        onClick={() => handleSelectLoadScheme(scheme)}
                        className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-left hover:border-emerald-500/40 hover:bg-emerald-50/40 dark:border-[#1b2c2e] dark:bg-[#122427] dark:hover:border-emerald-500/30"
                      >
                        <p className="text-sm font-extrabold text-gray-900 dark:text-white">
                          {label}
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                          {year ? `${year} · ` : ""}
                          {count != null
                            ? `${count} ${cfg.singularTitle.toLowerCase()}${count === 1 ? "" : "s"}`
                            : ""}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              <>
                <button
                  type="button"
                  disabled={isApplyingLoadScheme || loadItemsLoading}
                  onClick={() => {
                    setSelectedLoadScheme(null);
                    setLoadItems([]);
                    setSelectedAssessmentIds([]);
                  }}
                  className="text-xs font-extrabold text-[#15803d] hover:underline dark:text-emerald-300"
                >
                  ← Back to schemes
                </button>
                {loadItemsLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
                  </div>
                ) : loadItems.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No {cfg.pluralTitle.toLowerCase()} found in this scheme.
                  </p>
                ) : (
                  <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-[#1b2c2e] dark:bg-[#091517]">
                    {loadItems.map((item) => {
                      const aid = Number(item.assessmentId ?? item.AssessmentId);
                      const title = String(item.title ?? item.Title ?? "").trim();
                      const no = item.assessmentNo ?? item.AssessmentNo;
                      const marks = item.totalMarks ?? item.TotalMarks;
                      const qCount = item.questionCount ?? item.QuestionCount;
                      const already = Boolean(
                        item.alreadyInCurrent ?? item.AlreadyInCurrent
                      );
                      const checked = selectedAssessmentIds.includes(aid);
                      const displayTitle =
                        title ||
                        (no != null ? `${cfg.singularTitle} ${no}` : cfg.singularTitle);
                      return (
                        <label
                          key={aid}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl bg-white px-3 py-2.5 text-sm shadow-xs dark:bg-[#0c181a] ${
                            already ? "opacity-70" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            disabled={isApplyingLoadScheme}
                            onChange={() => toggleAssessmentSelection(aid)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-extrabold text-gray-900 dark:text-white">
                              {displayTitle}
                            </span>
                            <span className="mt-0.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
                              {marks != null ? `${marks} marks` : "No marks"}
                              {qCount != null
                                ? ` · ${qCount} question${qCount === 1 ? "" : "s"}`
                                : ""}
                            </span>
                            {already ? (
                              <span className="mt-0.5 block text-xs font-semibold text-amber-700">
                                Already filled in current section
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
                    loadItemsLoading ||
                    selectedAssessmentIds.length === 0
                  }
                  onClick={handleApplyLoadScheme}
                  className="w-full bg-[#15803d] hover:bg-[#166534] text-white font-black py-3.5 rounded-2xl text-sm shadow-md transition disabled:opacity-50"
                >
                  {isApplyingLoadScheme
                    ? "Applying…"
                    : `Load ${selectedAssessmentIds.length} ${cfg.singularTitle.toLowerCase()}${selectedAssessmentIds.length === 1 ? "" : "s"}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
