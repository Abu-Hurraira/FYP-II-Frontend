import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getAssessmentSummary, saveCloTaskCell, submitContentForReview } from "../../api/teacherApi";
import { approveHodSubmission } from "../../api/hodContentReviewApi";
import { getOfferedCourseUploadPermissions } from "../../api/hodUploadAllocationApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showConfirm, showAlert } from "../../utils/dialogs";
import { canManageClosFromPermissions } from "../../utils/uploadAllocationHelpers";

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

  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("matrix"); // "matrix" | "completion" | "remaining"
  const [summary, setSummary] = useState(null);
  const [uploadPermissions, setUploadPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  // Editable local state for Task-CLO matrix design shares
  const [matrixState, setMatrixState] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const isHod = user?.roleName === "HOD" || user?.role?.roleName === "HOD";
  const canManage = isHod || canManageClosFromPermissions(uploadPermissions);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [res, permissions] = await Promise.all([
        getAssessmentSummary(offeredCourseId, teacherUserId),
        getOfferedCourseUploadPermissions(offeredCourseId).catch(() => ({
          clos: false,
          configured: false,
        })),
      ]);

      setSummary(res);
      setUploadPermissions(permissions);

      // Initialize local matrix state for editing
      const initial = {};
      (res?.rows || []).forEach((row) => {
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

  const courseTitle = summary?.courseTitle || "Assessment";
  const subtitle = `${summary?.sectionName || ""} · ${summary?.teacherName || user?.fullName || ""}`.replace(/^ · /, "");

  // Calculate live column totals from matrixState
  const liveTotals = {};
  cloCodes.forEach((code) => {
    let sum = 0;
    rows.forEach((r) => {
      const val = Number(matrixState[r.taskName]?.[code] ?? 0);
      sum += Number.isNaN(val) ? 0 : val;
    });
    liveTotals[code] = Math.round(sum * 100) / 100;
  });

  const handleCellChange = (taskName, cloCode, rawVal) => {
    if (!canManage) return;

    let num = parseFloat(rawVal);
    if (Number.isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > 100) num = 100;

    setMatrixState((prev) => ({
      ...prev,
      [taskName]: {
        ...(prev[taskName] || {}),
        [cloCode]: num,
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
          const val = Number(matrixState[row.taskName]?.[clo.cloCode] ?? 0);
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

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-page">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand dark:border-gray-800 dark:border-t-brand" />
      </div>
    );
  }

  const contentStatus = summary?.contentStatus || "Draft";
  const isApproved = contentStatus === "Approved" || contentStatus === "approved";
  const isPending = contentStatus === "PendingReview" || contentStatus === "Submitted";
  const isRejected = contentStatus === "Rejected";

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
        {!canManage && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-xs sm:text-sm font-medium text-blue-900 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200">
            View-only: Only the teacher authorized by HOD can edit CLO-Task mapping design shares.
          </div>
        )}

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
            </div>

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
                          {r.taskName}
                        </td>
                        {cloCodes.map((code) => {
                          const currentVal = matrixState[r.taskName]?.[code] ?? 0;
                          return (
                            <td key={code} className="py-2.5 px-2 text-center">
                              {canManage ? (
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={currentVal}
                                  onChange={(e) => handleCellChange(r.taskName, code, e.target.value)}
                                  className="w-16 text-center py-1.5 px-1 rounded-lg border border-gray-200 bg-white dark:border-[#1b2c2e] dark:bg-[#122427] text-gray-900 dark:text-white font-extrabold text-xs sm:text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                              ) : (
                                <span className="font-extrabold text-xs sm:text-sm text-gray-900 dark:text-white">
                                  {currentVal}
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
          </div>
        )}

        {/* Tab 2: Completion */}
        {activeTab === "completion" && (
          <div className="space-y-6">
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 px-1">
              Completed question-level CLO coverage mapped against configured design shares.
            </p>

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
                              {r.completedLocal[code] ?? 0}
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
                              {r.completedTotals[code] ?? 0}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Remaining */}
        {activeTab === "remaining" && (
          <div className="space-y-6">
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
                              {r.remainingLocal[code] ?? 0}
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
                              {r.remainingTotals[code] ?? 0}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 pb-8">
          <div className="flex items-center gap-2">
            {canManage && activeTab === "matrix" && (
              <>
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
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="bg-[#0d9488] hover:bg-[#0f766e] text-white font-extrabold text-xs sm:text-sm px-6 py-2.5 rounded-2xl shadow-md transition"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
