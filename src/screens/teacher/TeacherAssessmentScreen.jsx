import React, { useCallback, useContext, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  getAssessmentSummary,
  saveCloTaskCell,
  submitContentForReview,
  getContentStatuses,
  addCloTaskType,
  removeCloTaskType,
} from "../../api/teacherApi";
import { getOfferedCourseUploadPermissions } from "../../api/hodUploadAllocationApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showConfirm, showAlert } from "../../utils/dialogs";
import { canManageCloTaskFromPermissions, pickContentTypeStatus, pickHodFeedback } from "../../utils/uploadAllocationHelpers";
import { HodRejectionBanner, useHodRejectionAlert } from "../../components/HodRejectionNotice.jsx";
import PercentInput from "../../components/PercentInput.jsx";

function pickDict(row, camel, pascal) {
  const src = row?.[camel] ?? row?.[pascal] ?? {};
  const out = {};
  for (const [key, value] of Object.entries(src)) {
    out[key] = Number(value ?? 0);
  }
  return out;
}

function AssessmentGridEmpty({ message, hint }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center shadow-card dark:border-[#1b2c2e] dark:bg-[#0c181a]">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{message}</p>
      {hint ? <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{hint}</p> : null}
    </div>
  );
}

export default function TeacherAssessmentScreen() {
  const { user } = useContext(AuthContext);
  const { offeredCourseId: ocParam } = useParams();
  const offeredCourseId = Number(ocParam);

  const [searchParams] = useSearchParams();
  const routeTeacher = searchParams.get("teacherUserId");
  const teacherUserId =
    routeTeacher != null && routeTeacher !== ""
      ? Number(routeTeacher) || user?.userId
      : user?.userId;

  const [activeTab, setActiveTab] = useState("matrix"); // "matrix" | "completion" | "remaining"
  const [summary, setSummary] = useState(null);
  const [uploadPermissions, setUploadPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  // Editable local state for Task-CLO matrix design shares
  const [matrixState, setMatrixState] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const isHod = user?.roleName === "HOD" || user?.role?.roleName === "HOD";
  const canManage = isHod || canManageCloTaskFromPermissions(uploadPermissions);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [res, permissions] = await Promise.all([
        getAssessmentSummary(offeredCourseId, teacherUserId),
        getOfferedCourseUploadPermissions(offeredCourseId, teacherUserId).catch(() => ({
          clos: false,
          cloTaskMapping: false,
          configured: false,
        })),
      ]);

      const programCourseId = res?.programCourseId ?? res?.ProgramCourseId;
      const statuses = programCourseId
        ? await getContentStatuses(programCourseId, teacherUserId, offeredCourseId).catch(() => [])
        : [];

      const rows = (res?.rows ?? res?.Rows ?? []).map((row) => ({
        taskName: row.taskName ?? row.TaskName,
        assessmentTypeId: row.assessmentTypeId ?? row.AssessmentTypeId,
        designShares: pickDict(row, "designShares", "DesignShares"),
        completedLocal: pickDict(row, "completedLocal", "CompletedLocal"),
        completedTotals: pickDict(row, "completedTotals", "CompletedTotals"),
        remainingLocal: pickDict(row, "remainingLocal", "RemainingLocal"),
        remainingTotals: pickDict(row, "remainingTotals", "RemainingTotals"),
      }));
      setSummary({
        ...res,
        programCourseId,
        courseTitle: res?.courseTitle ?? res?.CourseTitle,
        sectionName: res?.sectionName ?? res?.SectionName,
        teacherName: res?.teacherName ?? res?.TeacherName,
        contentStatus: pickContentTypeStatus(
          statuses,
          "CloTaskMapping",
          res?.contentStatus ?? res?.ContentStatus ?? "Draft"
        ),
        hodFeedback: pickHodFeedback(statuses, "CloTaskMapping"),
        warnings: res?.warnings ?? res?.Warnings ?? [],
        clos: (res?.clos ?? res?.Clos ?? []).map((c) => ({
          cloId: c.cloId ?? c.CloId,
          cloCode: c.cloCode ?? c.CloCode,
        })),
        cloCodes: res?.cloCodes ?? res?.CloCodes ?? [],
        rows,
      });
      setUploadPermissions(permissions);

      // Initialize local matrix state for editing
      const initial = {};
      rows.forEach((row) => {
        initial[row.taskName] = { ...(row.designShares || {}) };
      });
      setMatrixState(initial);
      setHasChanges(false);
    } catch (error) {
      showAlert("Error", error.message || "Failed to load assessment summary.");
    } finally {
      setLoading(false);
    }
  }, [offeredCourseId, teacherUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const cloItems = summary?.clos || [];
  const cloCodes = summary?.cloCodes || [];
  const rows = summary?.rows || [];
  const warnings = summary?.warnings || [];
  const gridReady = rows.length > 0 && cloCodes.length > 0;
  const emptyGrid = rows.length === 0
    ? {
        message: "Assessment types were not found, so the Task-CLO grid is empty.",
        hint: "Ask an administrator to add Assignment, Quiz, Mid, and Final assessment types.",
      }
    : {
        message: "Add CLOs for this course first. They will appear as columns here.",
        hint: "After CLOs are saved, refresh this page to map Assignment, Quiz, Mid, and Final.",
      };

  const courseTitle = summary?.courseTitle || "Assessment";
  const subtitle = `${summary?.sectionName || ""} · ${summary?.teacherName || user?.fullName || ""}`.replace(/^ · /, "");

  // Calculate live column totals from matrixState
  const liveTotals = {};
  cloCodes.forEach((code) => {
    let sum = 0;
    rows.forEach((r) => {
      const val = Number(matrixState[r.taskName]?.[code] || 0);
      sum += Number.isNaN(val) ? 0 : val;
    });
    liveTotals[code] = Math.round(sum * 100) / 100;
  });

  const handleCellChange = (taskName, cloCode, rawVal) => {
    if (!canManage) return;

    setMatrixState((prev) => ({
      ...prev,
      [taskName]: {
        ...(prev[taskName] || {}),
        [cloCode]: rawVal,
      },
    }));
    setHasChanges(true);
  };

  const handleSaveChanges = async () => {
    if (!canManage) {
      showAlert("Permission Denied", "Only teachers allowed by HOD can edit CLO-Task mapping.");
      return;
    }

    if (!summary?.programCourseId) {
      showAlert("Error", "Program course information is missing.");
      return;
    }

    // Check if any CLO total exceeds 100%
    for (const code of cloCodes) {
      if (liveTotals[code] > 100.01) {
        showAlert(
          "Validation Error",
          `${code} column total is currently ${liveTotals[code]}%. Each CLO column total cannot exceed 100%. Please reduce the task percentages for ${code} before saving.`
        );
        return;
      }
    }

    const confirmed = await showConfirm(
      "Save Task-CLO Mapping",
      "Do you want to save these CLO-Task design shares?"
    );
    if (!confirmed) return;

    try {
      setIsSaving(true);

      const savePromises = [];
      rows.forEach((row) => {
        cloItems.forEach((clo) => {
          const val = Number(matrixState[row.taskName]?.[clo.cloCode] || 0);
          savePromises.push(
            saveCloTaskCell(summary.programCourseId, {
              updatedByUserId: teacherUserId,
              offeredCourseId,
              cloId: clo.cloId,
              assessmentTypeId: row.assessmentTypeId,
              percentage: val,
            })
          );
        });
      });

      await Promise.all(savePromises);
      showAlert("Saved", "CLO-Task mapping updated successfully.");
      await loadData();
    } catch (err) {
      showAlert("Error", err.message || "Failed to save CLO-Task mapping.");
    } finally {
      setIsSaving(false);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);

  const builtInTaskNames = new Set(["Assignment", "Quiz", "Mid", "Final"]);

  const handleAddCustomTask = async () => {
    if (!canManage || !summary?.programCourseId) return;
    const name = newTaskName.trim();
    if (name.length < 2) {
      showAlert("Validation", "Enter a task name (at least 2 characters).");
      return;
    }
    try {
      setTaskBusy(true);
      await addCloTaskType(summary.programCourseId, {
        teacherUserId,
        offeredCourseId,
        taskName: name,
      });
      setNewTaskName("");
      setAddingTask(false);
      showAlert("Added", `"${name}" was added as a custom task column.`);
      await loadData();
    } catch (err) {
      showAlert("Error", err.message || "Failed to add task.");
    } finally {
      setTaskBusy(false);
    }
  };

  const handleRemoveCustomTask = async (row) => {
    if (!canManage || !summary?.programCourseId || !row?.assessmentTypeId) return;
    if (builtInTaskNames.has(row.taskName)) {
      showAlert("Not allowed", "Built-in tasks (Assignment, Quiz, Mid, Final) cannot be removed.");
      return;
    }
    const ok = await showConfirm(
      "Remove custom task",
      `Remove "${row.taskName}" from this course’s CLO-Task matrix?`
    );
    if (!ok) return;
    try {
      setTaskBusy(true);
      await removeCloTaskType(summary.programCourseId, row.assessmentTypeId, {
        teacherUserId,
        offeredCourseId,
        assessmentTypeId: row.assessmentTypeId,
      });
      await loadData();
    } catch (err) {
      showAlert("Error", err.message || "Failed to remove task.");
    } finally {
      setTaskBusy(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!canManage) {
      showAlert("Permission Denied", "Only teachers allowed by HOD can submit CLO-Task mapping.");
      return;
    }

    if (!summary?.programCourseId) {
      showAlert("Error", "Program course information is missing.");
      return;
    }

    // Check if every CLO column sums to 100%
    for (const code of cloCodes) {
      if (Math.abs(liveTotals[code] - 100) > 0.01) {
        showAlert(
          "Validation Error",
          `${code} column total is currently ${liveTotals[code]}%. Every approved CLO must total exactly 100% across Assignment, Quiz, Mid, and Final before submitting for HOD approval.`
        );
        return;
      }
    }

    const confirmed = await showConfirm(
      "Submit for HOD Approval",
      "Submit this CLO-Task mapping to HOD for approval? Once approved by HOD, question creation and assessment tasks will be unlocked for all section teachers."
    );
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      await submitContentForReview(summary.programCourseId, {
        teacherUserId,
        offeredCourseId,
        contentTypeCode: "CloTaskMapping",
      });

      showAlert(
        "Submitted",
        "CLO-Task mapping submitted to HOD for approval! You will be notified once HOD reviews it."
      );
      await loadData();
    } catch (err) {
      showAlert("Error", err.message || "Failed to submit CLO-Task mapping for review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const contentStatus = String(summary?.contentStatus || "Draft");
  const statusKey = contentStatus.toLowerCase();
  const isApproved = statusKey === "approved";
  const isPending = statusKey === "pendingreview" || statusKey === "submitted";
  const isRejected = statusKey === "rejected";
  const canEdit = canManage && !isApproved && !isPending;
  useHodRejectionAlert(!loading && isRejected, "CLO-Task mapping", summary?.hodFeedback);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-page">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand dark:border-gray-800 dark:border-t-brand" />
      </div>
    );
  }

  return (
    <div className="relative min-h-full bg-page">
      {/* Standard Header Bar */}
      <div className="border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8 dark:border-[#1b2c2e] dark:bg-[#071113]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <PageBackButton className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-semibold text-gray-900 dark:text-white">
                Assessment
              </h1>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {courseTitle} {subtitle ? `· ${subtitle}` : ""}
              </p>
            </div>
          </div>

          <div>
            {isApproved ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Status: Approved by HOD
              </span>
            ) : isPending ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-black text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/60 dark:text-amber-300 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Status: Pending HOD Review
              </span>
            ) : isRejected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-black text-red-800 dark:border-red-800/40 dark:bg-red-950/60 dark:text-red-300 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Status: Rejected by HOD
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs font-black text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 shadow-sm">
                Status: Draft
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8 space-y-4">
        {isRejected ? <HodRejectionBanner title="CLO-Task mapping" reason={summary?.hodFeedback} /> : null}

        {/* Sub Tabs Segmented Control */}
        <div className="flex items-center justify-between gap-1 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-card shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
          <button
            type="button"
            onClick={() => setActiveTab("matrix")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all text-center ${
              activeTab === "matrix"
                ? "bg-[#15803d] text-white shadow-sm dark:bg-[#166534]"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-semibold"
            }`}
          >
            Task-CLO map
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("completion")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all text-center ${
              activeTab === "completion"
                ? "bg-[#15803d] text-white shadow-sm dark:bg-[#166534]"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-semibold"
            }`}
          >
            Completion
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("remaining")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all text-center ${
              activeTab === "remaining"
                ? "bg-[#15803d] text-white shadow-sm dark:bg-[#166534]"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-semibold"
            }`}
          >
            Remaining
          </button>
        </div>

        {/* Permission Info Notice */}
        {isPending ? (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs sm:text-sm font-medium text-amber-900 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300">
            Submitted to HOD. Editing is locked until the HOD approves or rejects this mapping.
          </div>
        ) : isApproved ? (
          <div className="rounded-xl border border-emerald-800/20 bg-[#f4fbf7] px-4 py-3 text-xs sm:text-sm font-medium text-[#15803d] shadow-sm dark:bg-[#091816] dark:text-emerald-300 dark:border-emerald-800/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                Approved by HOD. This Task-CLO mapping is locked and shared with other sections of this subject.
              </span>
            </div>
          </div>
        ) : !canManage ? (
          <div className="rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-xs sm:text-sm font-medium text-blue-900 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200">
            View-only: only the teacher authorized by HOD can edit CLO-Task mapping. After they save
            and HOD approves, it is shared with every other section of this subject.
          </div>
        ) : null}

        {/* Warning Banner */}
        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs sm:text-sm font-semibold text-amber-900 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300 space-y-1">
            {warnings.map((warn, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-base leading-none">•</span>
                <span>{warn}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tab 1: Task-CLO map */}
        {activeTab === "matrix" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Task and CLO design shares. Tasks as rows, CLOs as columns. Each CLO column totals up to 100.
              </p>
              {canEdit ? (
                <div className="flex flex-wrap items-center gap-2">
                  {addingTask ? (
                    <>
                      <input
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-[#1b2c2e] dark:bg-[#0c181a]"
                        placeholder="Custom task name"
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                      />
                      <button
                        type="button"
                        disabled={taskBusy}
                        onClick={handleAddCustomTask}
                        className="rounded-lg bg-[#15803d] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {taskBusy ? "…" : "Add"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingTask(false);
                          setNewTaskName("");
                        }}
                        className="text-xs font-semibold text-gray-500"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingTask(true)}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      + Custom task
                    </button>
                  )}
                </div>
              ) : null}
            </div>

            {!gridReady ? (
              <AssessmentGridEmpty message={emptyGrid.message} hint={emptyGrid.hint} />
            ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#15803d] text-white dark:bg-[#14482b]">
                      <th className="py-3.5 px-4 text-xs font-black uppercase tracking-wider text-center">Task</th>
                      {cloCodes.map((code) => (
                        <th key={code} className="py-3.5 px-4 text-xs font-black uppercase tracking-wider text-center">
                          {code}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#1b2c2e]">
                    {rows.map((r, rIdx) => (
                      <tr
                        key={r.taskName}
                        className={rIdx % 2 === 0 ? "bg-white dark:bg-[#0c181a]" : "bg-gray-50/50 dark:bg-[#091517]"}
                      >
                        <td className="py-3.5 px-4 text-xs sm:text-sm font-extrabold text-[#15803d] dark:text-[#34d399] text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span>{r.taskName}</span>
                            {canEdit && !builtInTaskNames.has(r.taskName) ? (
                              <button
                                type="button"
                                disabled={taskBusy}
                                onClick={() => handleRemoveCustomTask(r)}
                                className="text-[10px] font-semibold text-red-600 hover:underline disabled:opacity-50"
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </td>
                        {cloCodes.map((code) => {
                          const currentVal = matrixState[r.taskName]?.[code] ?? 0;
                          return (
                            <td key={code} className="py-2.5 px-2 text-center">
                              {canEdit ? (
                                <PercentInput
                                  value={currentVal}
                                  onChange={(next) => handleCellChange(r.taskName, code, next)}
                                />
                              ) : (
                                <span className="font-extrabold text-xs sm:text-sm text-gray-900 dark:text-white">
                                  {Number(currentVal || 0)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="bg-amber-50/70 border-t-2 border-amber-200/70 dark:bg-[#201d14] dark:border-amber-500/30">
                      <td className="py-3.5 px-4 text-xs sm:text-sm font-black text-amber-900 dark:text-amber-300 text-center">
                        Total
                      </td>
                      {cloCodes.map((code) => {
                        const tot = liveTotals[code] ?? 0;
                        const isComplete = Math.abs(tot - 100) < 0.01;
                        const isExceeded = tot > 100.01;
                        return (
                          <td
                            key={code}
                            className={`py-3.5 px-4 text-xs sm:text-sm font-black text-center ${
                              isExceeded
                                ? "text-red-700 bg-red-100/90 dark:bg-red-950/60 dark:text-red-300 rounded-lg"
                                : isComplete
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-amber-900 dark:text-amber-300"
                            }`}
                          >
                            {tot} {isExceeded ? "⚠️ (>100)" : isComplete ? "✓" : ""}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            )}
          </div>
        )}

        {/* Tab 2: Completion */}
        {activeTab === "completion" && (
          <div className="space-y-6">
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 px-1">
              Completed question-level CLO coverage mapped against configured design shares.
            </p>

            {!gridReady ? (
              <AssessmentGridEmpty message={emptyGrid.message} hint={emptyGrid.hint} />
            ) : (
            <>
            {/* Completed Local Table */}
            <div className="space-y-2">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white px-1">Completed Local (%)</h3>
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#15803d] text-white dark:bg-[#14482b]">
                        <th className="py-3 px-4 text-xs font-black uppercase tracking-wider text-center">Task</th>
                        {cloCodes.map((code) => (
                          <th key={code} className="py-3 px-4 text-xs font-black uppercase tracking-wider text-center">
                            {code}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-[#1b2c2e]">
                      {rows.map((r, rIdx) => (
                        <tr
                          key={r.taskName}
                          className={rIdx % 2 === 0 ? "bg-white dark:bg-[#0c181a]" : "bg-gray-50/50 dark:bg-[#091517]"}
                        >
                          <td className="py-3.5 px-4 text-xs sm:text-sm font-extrabold text-[#15803d] dark:text-[#34d399] text-center">
                            {r.taskName}
                          </td>
                          {cloCodes.map((code) => (
                            <td key={code} className="py-3.5 px-4 text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white text-center">
                              {r.completedLocal?.[code] ?? 0}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Completed Totals Table */}
            <div className="space-y-2">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white px-1">Completed Totals (%)</h3>
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#15803d] text-white dark:bg-[#14482b]">
                        <th className="py-3 px-4 text-xs font-black uppercase tracking-wider text-center">Task</th>
                        {cloCodes.map((code) => (
                          <th key={code} className="py-3 px-4 text-xs font-black uppercase tracking-wider text-center">
                            {code}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-[#1b2c2e]">
                      {rows.map((r, rIdx) => (
                        <tr
                          key={r.taskName}
                          className={rIdx % 2 === 0 ? "bg-white dark:bg-[#0c181a]" : "bg-gray-50/50 dark:bg-[#091517]"}
                        >
                          <td className="py-3.5 px-4 text-xs sm:text-sm font-extrabold text-[#15803d] dark:text-[#34d399] text-center">
                            {r.taskName}
                          </td>
                          {cloCodes.map((code) => (
                            <td key={code} className="py-3.5 px-4 text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white text-center">
                              {r.completedTotals?.[code] ?? 0}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            </>
            )}
          </div>
        )}

        {/* Tab 3: Remaining */}
        {activeTab === "remaining" && (
          <div className="space-y-6">
            {!gridReady ? (
              <AssessmentGridEmpty message={emptyGrid.message} hint={emptyGrid.hint} />
            ) : (
            <>
            {/* Remaining Local Table */}
            <div className="space-y-2">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white px-1">Remaining Local</h3>
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#15803d] text-white dark:bg-[#14482b]">
                        <th className="py-3 px-4 text-xs font-black uppercase tracking-wider text-center">Task</th>
                        {cloCodes.map((code) => (
                          <th key={code} className="py-3 px-4 text-xs font-black uppercase tracking-wider text-center">
                            {code}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-[#1b2c2e]">
                      {rows.map((r, rIdx) => (
                        <tr
                          key={r.taskName}
                          className={rIdx % 2 === 0 ? "bg-white dark:bg-[#0c181a]" : "bg-gray-50/50 dark:bg-[#091517]"}
                        >
                          <td className="py-3.5 px-4 text-xs sm:text-sm font-extrabold text-[#15803d] dark:text-[#34d399] text-center">
                            {r.taskName}
                          </td>
                          {cloCodes.map((code) => (
                            <td key={code} className="py-3.5 px-4 text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white text-center">
                              {r.remainingLocal?.[code] ?? 0}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Remaining Totals Table */}
            <div className="space-y-2">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white px-1">Remaining Totals</h3>
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#15803d] text-white dark:bg-[#14482b]">
                        <th className="py-3 px-4 text-xs font-black uppercase tracking-wider text-center">Task</th>
                        {cloCodes.map((code) => (
                          <th key={code} className="py-3 px-4 text-xs font-black uppercase tracking-wider text-center">
                            {code}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-[#1b2c2e]">
                      {rows.map((r, rIdx) => (
                        <tr
                          key={r.taskName}
                          className={rIdx % 2 === 0 ? "bg-white dark:bg-[#0c181a]" : "bg-gray-50/50 dark:bg-[#091517]"}
                        >
                          <td className="py-3.5 px-4 text-xs sm:text-sm font-extrabold text-[#15803d] dark:text-[#34d399] text-center">
                            {r.taskName}
                          </td>
                          {cloCodes.map((code) => (
                            <td key={code} className="py-3.5 px-4 text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white text-center">
                              {r.remainingTotals?.[code] ?? 0}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            </>
            )}
          </div>
        )}

        {canEdit && activeTab === "matrix" && (
        <div className="flex flex-wrap items-center gap-3 pt-4 pb-8">
          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={isSaving}
            className="bg-[#15803d] hover:bg-[#166534] text-white font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-2xl shadow-md transition disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save Task-CLO Mapping"}
          </button>
          <button
            type="button"
            onClick={handleSubmitForReview}
            disabled={isSubmitting}
            className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-2xl shadow-md transition disabled:opacity-50"
          >
            {isSubmitting ? "Uploading…" : "Upload for HOD Approval"}
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
