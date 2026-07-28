import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getAssessmentsList,
  createAssessment,
  updateAssessment,
  getAssessmentDetail,
  addAssessmentQuestion,
  uploadAssessmentFile,
  getAvailableClos,
} from "../../api/teacherApi";
import { getCLOsByProgramCourse } from "../../api/closApi";
import { getCourseMenu } from "../../api/teacherApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showConfirm, showAlert } from "../../utils/dialogs";

export default function TeacherQuizzesScreen() {
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

  const [course, setCourse] = useState(null);
  const [clos, setClos] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selected quiz for setup/detail view
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(null);
  const [selectedAssessmentDetail, setSelectedAssessmentDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newTotalMarks, setNewTotalMarks] = useState("10");
  const [isSubmittingTemplate, setIsSubmittingTemplate] = useState(false);

  // Edit Template state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editTotalMarks, setEditTotalMarks] = useState("10");
  const [isUpdatingTemplate, setIsUpdatingTemplate] = useState(false);

  const handleOpenEditModal = () => {
    if (!selectedAssessmentDetail) return;
    setEditTitle(selectedAssessmentDetail.title || "");
    setEditDueDate(selectedAssessmentDetail.dueDate || "");
    setEditTotalMarks(String(selectedAssessmentDetail.totalMarks || 10));
    setEditModalOpen(true);
  };

  const handleUpdateTemplate = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      showAlert("Validation Error", "Title is required.");
      return;
    }

    try {
      setIsUpdatingTemplate(true);
      const updated = await updateAssessment(selectedAssessmentId, {
        teacherUserId,
        title: editTitle.trim(),
        dueDate: editDueDate || null,
        totalMarks: Number(editTotalMarks) || 10,
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

  // File upload state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadPurpose, setUploadPurpose] = useState("Solution");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [cData, listData] = await Promise.all([
        getCourseMenu(offeredCourseId),
        getAssessmentsList(offeredCourseId, teacherUserId, "Quiz"),
      ]);
      setCourse(cData);
      setAssessments(listData || []);

      if (cData?.programCourseId) {
        const cloList = await getAvailableClos(offeredCourseId, teacherUserId, "Quiz");
        setClos(cloList || []);
      }
    } catch (error) {
      showAlert("Error", error.message || "Failed to load quizzes.");
    } finally {
      setLoading(false);
    }
  }, [offeredCourseId, teacherUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const [expandedQuestions, setExpandedQuestions] = useState({});

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
        const detail = await getAssessmentDetail(assessmentId, teacherUserId);
        setSelectedAssessmentDetail(detail);

        // Pre-fill question draft (collapsed by default)
        if (detail?.questions && detail.questions.length > 0) {
          const draft = detail.questions.map((q) => ({
            questionNo: q.questionNo || "",
            questionText: q.questionText || "",
            marks: q.marks || 10,
            cloMappings: (q.cloMappings || []).map((m) => ({
              cloId: m.cloId,
              cloCode: m.cloCode,
              percentage: m.percentage || 0,
            })),
          }));
          setQuestionsDraft(draft);
          setExpandedQuestions({});
        } else {
          // Initialize with default Q1 (expanded)
          setQuestionsDraft([
            {
              questionNo: "Q1",
              questionText: "",
              marks: 10,
              cloMappings: clos.length > 0 ? [{ cloId: clos[0].cloId, cloCode: clos[0].cloCode, percentage: 0 }] : [],
            },
          ]);
          setExpandedQuestions({ 0: true });
        }
      } catch (error) {
        showAlert("Error", error.message || "Failed to load quiz details.");
      } finally {
        setLoadingDetail(false);
      }
    },
    [teacherUserId, clos]
  );

  const handleSelectAssessment = (assessmentId) => {
    setSelectedAssessmentId(assessmentId);
    loadDetail(assessmentId);
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      showAlert("Validation Error", "Title is required.");
      return;
    }

    try {
      setIsSubmittingTemplate(true);
      await createAssessment({
        teacherUserId,
        offeredCourseId,
        assessmentTypeName: "Quiz",
        title: newTitle.trim(),
        dueDate: newDueDate || null,
        totalMarks: Number(newTotalMarks) || 10,
      });

      showAlert("Success", "Quiz template created successfully.");
      setAddModalOpen(false);
      setNewTitle("");
      setNewDueDate("");
      setNewTotalMarks("10");
      await loadData();
    } catch (err) {
      showAlert("Error", err.message || "Failed to create quiz template.");
    } finally {
      setIsSubmittingTemplate(false);
    }
  };

  const handleAddQuestionRow = () => {
    const nextQNo = `Q${questionsDraft.length + 1}`;
    const newIdx = questionsDraft.length;
    setQuestionsDraft((prev) => [
      ...prev,
      {
        questionNo: nextQNo,
        questionText: "",
        marks: 10,
        cloMappings: clos.length > 0 ? [{ cloId: clos[0].cloId, cloCode: clos[0].cloCode, percentage: 0 }] : [],
      },
    ]);
    setExpandedQuestions((prev) => ({ ...prev, [newIdx]: true }));
  };

  const handleQuestionChange = (index, field, value) => {
    setQuestionsDraft((prev) => {
      const copy = [...prev];
      let val = value;

      if (field === "marks") {
        let num = parseFloat(value);
        if (Number.isNaN(num) || num < 0) num = 0;
        const totalMarks = selectedAssessmentDetail?.totalMarks || 10;
        const sumOthers = prev.reduce(
          (acc, q, i) => (i === index ? acc : acc + (Number(q.marks) || 0)),
          0
        );
        const maxAllowed = Math.max(0, totalMarks - sumOthers);
        if (num > maxAllowed) {
          num = maxAllowed;
          showAlert("Info", `Question marks cannot exceed total quiz marks (${totalMarks}). Capped at ${maxAllowed}.`);
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
      const selectedClo = clos.find((c) => c.cloId === targetCloId);

      let num = parseFloat(percentage);
      if (Number.isNaN(num) || num < 0) num = 0;

      // Sum used percentage for targetCloId in all OTHER questions
      const sumOthers = prev.reduce((acc, q, i) => {
        if (i === qIndex) return acc;
        const mapping = q.cloMappings?.find((m) => Number(m.cloId) === targetCloId);
        return acc + (Number(mapping?.percentage) || 0);
      }, 0);

      const maxAllowed = Math.max(0, Math.round((100 - sumOthers) * 100) / 100);
      if (num > maxAllowed) {
        num = maxAllowed;
        showAlert("Info", `CLO coverage cannot exceed remaining 100% budget. Capped at ${maxAllowed}%.`);
      }

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

    for (let i = 0; i < questionsDraft.length; i++) {
      const q = questionsDraft[i];
      if (!q.questionText.trim()) {
        showAlert("Validation Error", `Question text is required for ${q.questionNo}.`);
        return;
      }
      if (!q.cloMappings || q.cloMappings.length === 0) {
        showAlert("Validation Error", `Please map a CLO for ${q.questionNo}.`);
        return;
      }
    }

    try {
      setIsSavingQuestions(true);
      for (const q of questionsDraft) {
        await addAssessmentQuestion(selectedAssessmentId, {
          teacherUserId,
          questionNo: q.questionNo,
          questionText: q.questionText,
          marks: Number(q.marks) || 5,
          cloMappings: q.cloMappings.map((m) => ({
            cloId: m.cloId,
            percentage: Number(m.percentage) || 100,
          })),
        });
      }

      showAlert("Saved", "Quiz questions and CLO mappings saved.");
      await loadDetail(selectedAssessmentId);
      await loadData();
    } catch (err) {
      showAlert("Error", err.message || "Failed to save questions.");
    } finally {
      setIsSavingQuestions(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !selectedAssessmentId) {
      showAlert("Validation Error", "Please select a PDF file first.");
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
    } catch (err) {
      showAlert("Upload Error", err.message || "Failed to upload file.");
    } finally {
      setIsUploadingFile(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-page">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand dark:border-gray-800 dark:border-t-brand" />
      </div>
    );
  }

  const courseTitle = course?.courseTitle || "Quizzes";

  // Calculate left marks for questions
  const totalMarks = selectedAssessmentDetail?.totalMarks || 10;
  const questionsMarksSum = questionsDraft.reduce(
    (sum, q) => sum + (Number(q.marks) || 0),
    0
  );
  const leftForQuestions = Math.max(0, totalMarks - questionsMarksSum);

  const solutionFile = selectedAssessmentDetail?.files?.find(
    (f) => f.filePurpose?.toLowerCase() === "solution"
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
                {selectedAssessmentId ? selectedAssessmentDetail?.title || "Quiz Detail" : "Quizzes"}
              </h1>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {courseTitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8 space-y-4">
        {/* VIEW 1: QUIZZES LIST */}
        {!selectedAssessmentId && (
          <div className="space-y-4 max-w-2xl mx-auto">
            {/* Header Info Banner */}
            <div className="rounded-2xl border border-emerald-800/20 bg-[#f4fbf7] p-4 text-xs sm:text-sm font-bold text-[#15803d] shadow-sm dark:bg-[#091816] dark:text-emerald-300 dark:border-emerald-800/30">
              8 required quizzes must be filled for folder submission. Solution/sample uploads and question PDFs go into the master folder.
            </div>

            {/* List of Quiz Cards */}
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
                          {item.title}
                        </h3>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
                          {item.dueDate ? `Due ${item.dueDate} · ` : ""}{item.totalMarks} marks
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

            {/* Bottom Buttons */}
            <div className="flex items-center justify-between pt-4 gap-3">
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="bg-[#15803d] hover:bg-[#166534] text-white font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-2xl shadow-md transition active:scale-95 flex-1"
              >
                Add Quiz Template +
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="bg-[#0d9488] hover:bg-[#0f766e] text-white font-extrabold text-xs sm:text-sm px-6 py-2.5 rounded-2xl shadow-md transition active:scale-95"
              >
                Go Back
              </button>
            </div>
          </div>
        )}

        {/* VIEW 2: QUIZ SETUP / DETAIL */}
        {selectedAssessmentId && (
          <div className="space-y-4 max-w-2xl mx-auto">
            {loadingDetail ? (
              <div className="flex min-h-[30vh] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
              </div>
            ) : (
              <>
                {/* Card 1: Quiz Solution */}
                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a] flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                      Quiz Solution
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                      {solutionFile ? solutionFile.fileName : "PDF solution not uploaded yet"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setUploadPurpose("Solution");
                        setUploadModalOpen(true);
                      }}
                      className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-black text-xs px-4 py-2 rounded-xl shadow-sm transition"
                    >
                      Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (solutionFile?.filePath) {
                          window.open(`/api/CourseFolders/download?filePath=${encodeURIComponent(solutionFile.filePath)}`, "_blank");
                        } else {
                          showAlert("Info", "No solution file uploaded yet.");
                        }
                      }}
                      className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-extrabold text-xs px-4 py-2 rounded-xl transition"
                    >
                      Preview
                    </button>
                  </div>
                </div>

                {/* Card 2: Best Average Worst */}
                <div
                  onClick={() => {
                    setUploadPurpose("Best Sample");
                    setUploadModalOpen(true);
                  }}
                  className="cursor-pointer rounded-2xl border border-gray-100 bg-white p-4 shadow-card shadow-sm transition hover:border-emerald-500/30 dark:border-[#1b2c2e] dark:bg-[#0c181a] flex items-center justify-between"
                >
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                      Best Average Worst
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                      {selectedAssessmentDetail?.files?.filter(f => f.filePurpose?.includes("Sample"))?.length || 0} Items
                    </p>
                  </div>
                  <span className="text-xl font-bold text-gray-400">›</span>
                </div>

                {/* Card 3: Enter Marks */}
                <div
                  onClick={() => showAlert("Info", "Student question marks entry interface.")}
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
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a] space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1b2c2e] pb-3">
                    <div>
                      <h3 className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>{selectedAssessmentDetail?.title}</span>
                        <button
                          type="button"
                          onClick={handleOpenEditModal}
                          title="Edit template title, due date & marks"
                          className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-200 flex items-center justify-center text-xs transition"
                        >
                          ✎
                        </button>
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                        {selectedAssessmentDetail?.dueDate ? `Due ${selectedAssessmentDetail.dueDate} · ` : ""}
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                          {totalMarks} marks · {leftForQuestions} left for questions
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Remaining CLOs Budget Banner */}
                  {clos.length > 0 && (
                    <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-3 dark:border-emerald-800/30 dark:bg-[#091816] space-y-1.5">
                      <p className="text-xs font-black uppercase tracking-wider text-[#15803d] dark:text-[#34d399]">
                        Remaining CLO Coverage Budget (this Quiz)
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {clos.map((c) => {
                          const used = questionsDraft.reduce((acc, q) => {
                            const mapping = q.cloMappings?.find((m) => Number(m.cloId) === Number(c.cloId));
                            return acc + (Number(mapping?.percentage) || 0);
                          }, 0);
                          const rem = Math.max(0, Math.round((100 - used) * 100) / 100);
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
                            >
                              {c.cloCode}: {rem}% left
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
                      const primaryClo = q.cloMappings?.[0];

                      return (
                        <div
                          key={idx}
                          className="rounded-xl border border-gray-100 bg-[#f9fafb] dark:bg-[#091517] dark:border-[#1b2c2e] overflow-hidden transition-all shadow-xs"
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
                                {q.marks || 0} Marks
                              </span>

                              {primaryClo ? (
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
                                  onChange={(e) => handleQuestionChange(idx, "questionText", e.target.value)}
                                  placeholder="Enter question text..."
                                  className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs sm:text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                                />
                              </div>

                              <div className="flex items-center gap-3">
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                  Marks
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  max="100"
                                  value={q.marks}
                                  onChange={(e) => handleQuestionChange(idx, "marks", e.target.value)}
                                  className="w-20 rounded-lg border border-gray-200 bg-white py-1 px-2 text-xs sm:text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                                />
                              </div>

                              {/* CLO Mapping */}
                              <div className="rounded-lg bg-emerald-50/70 border border-emerald-200/60 p-2.5 dark:bg-[#0f241f] dark:border-emerald-800/30 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-[#15803d] dark:text-[#34d399]">
                                    Map CLO
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <select
                                    value={q.cloMappings?.[0]?.cloId || (clos[0]?.cloId ?? "")}
                                    onChange={(e) =>
                                      handleQuestionCloChange(
                                        idx,
                                        e.target.value,
                                        q.cloMappings?.[0]?.percentage || 100
                                      )
                                    }
                                    className="flex-1 rounded-lg border border-gray-200 bg-white py-1.5 px-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                                  >
                                    {clos.map((c) => {
                                      const sumOther = questionsDraft.reduce((acc, qRow, qIdx) => {
                                        if (qIdx === idx) return acc;
                                        const mapping = qRow.cloMappings?.find((m) => Number(m.cloId) === Number(c.cloId));
                                        return acc + (Number(mapping?.percentage) || 0);
                                      }, 0);
                                      const rem = Math.max(0, Math.round((100 - sumOther) * 100) / 100);
                                      return (
                                        <option key={c.cloId} value={c.cloId}>
                                          {c.cloCode} ({rem}% left) {c.description ? `- ${c.description.substring(0, 20)}` : ""}
                                        </option>
                                      );
                                    })}
                                  </select>

                                  <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={q.cloMappings?.[0]?.percentage || 100}
                                    onChange={(e) =>
                                      handleQuestionCloChange(
                                        idx,
                                        q.cloMappings?.[0]?.cloId || clos[0]?.cloId,
                                        e.target.value
                                      )
                                    }
                                    title="Coverage Percentage (0-100%)"
                                    className="w-16 rounded-lg border border-gray-200 bg-white py-1.5 px-1 text-center text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                                  />
                                  <span className="text-xs font-bold text-gray-500">%</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={handleAddQuestionRow}
                      className="w-full py-2.5 rounded-xl border border-dashed border-emerald-600/40 text-[#15803d] dark:text-[#34d399] font-extrabold text-xs hover:bg-emerald-50/50 dark:hover:bg-[#0f241f] transition"
                    >
                      + Add Question
                    </button>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSaveQuestions}
                      disabled={isSavingQuestions}
                      className="w-full bg-[#15803d] hover:bg-[#166534] text-white font-extrabold text-sm py-3 rounded-2xl shadow-md transition disabled:opacity-50"
                    >
                      {isSavingQuestions ? "Saving Questions…" : "Save Quiz Questions"}
                    </button>
                  </div>
                </div>

                {/* Back Button */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAssessmentId(null)}
                    className="bg-[#0d9488] hover:bg-[#0f766e] text-white font-extrabold text-xs sm:text-sm px-6 py-2.5 rounded-2xl shadow-md transition"
                  >
                    Go Back
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: ADD QUIZ TEMPLATE */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#0c181a] border border-gray-100 dark:border-[#1b2c2e] space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white">
                  Add Quiz Template
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                  8 quiz templates are required by default. Add an extra template here with a title, due date, and total marks.
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
              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                  Quiz Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Quiz 9 - Recursion"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 p-3 text-xs sm:text-sm font-semibold text-gray-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                />
              </div>

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

              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                  Total Marks
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  required
                  placeholder="e.g. 10"
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
                  {isSubmittingTemplate ? "Saving…" : "Save Quiz"}
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
                  Select a PDF file to upload into the master folder.
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
                  File Category / Purpose
                </label>
                <select
                  value={uploadPurpose}
                  onChange={(e) => setUploadPurpose(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 p-3 text-xs sm:text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                >
                  <option value="Solution">Solution PDF</option>
                  <option value="Best Sample">Best Sample PDF</option>
                  <option value="Average Sample">Average Sample PDF</option>
                  <option value="Worst Sample">Worst Sample PDF</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-gray-700 dark:text-gray-300 mb-1">
                  Select PDF File
                </label>
                <input
                  type="file"
                  accept=".pdf"
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
                  {isUploadingFile ? "Uploading…" : "Upload PDF"}
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
              Update template title, due date, and total marks.
            </p>

            <form onSubmit={handleUpdateTemplate} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white font-medium"
                />
              </div>

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

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Total Marks
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  required
                  value={editTotalMarks}
                  onChange={(e) => setEditTotalMarks(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white font-medium"
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
    </div>
  );
}
