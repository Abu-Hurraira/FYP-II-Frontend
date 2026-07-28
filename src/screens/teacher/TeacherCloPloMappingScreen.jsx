import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getCloPloMatrix,
  saveCloPloCell,
  submitContentForReview,
  getCourseMenu,
} from "../../api/teacherApi";
import { getOfferedCourseUploadPermissions } from "../../api/hodUploadAllocationApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showConfirm, showAlert } from "../../utils/dialogs";
import { canManageClosFromPermissions } from "../../utils/uploadAllocationHelpers";

export default function TeacherCloPloMappingScreen() {
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

  const [matrix, setMatrix] = useState(null);
  const [course, setCourse] = useState(null);
  const [uploadPermissions, setUploadPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  // Editable matrix state: { [cloId]: { [ploId]: number } }
  const [matrixState, setMatrixState] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const isHod = user?.roleName === "HOD" || user?.role?.roleName === "HOD";
  const canManage = isHod || canManageClosFromPermissions(uploadPermissions);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const cData = await getCourseMenu(offeredCourseId);
      setCourse(cData);

      const pCourseId = cData?.programCourseId;
      if (!pCourseId) {
        showAlert("Error", "Program course info missing.");
        return;
      }

      const [matrixRes, permissions] = await Promise.all([
        getCloPloMatrix(pCourseId, teacherUserId, offeredCourseId),
        getOfferedCourseUploadPermissions(offeredCourseId).catch(() => ({
          clos: false,
          configured: false,
        })),
      ]);

      setMatrix(matrixRes);
      setUploadPermissions(permissions);

      // Initialize local state
      const initial = {};
      (matrixRes?.clos || []).forEach((row) => {
        initial[row.cloId] = {};
        (row.cells || []).forEach((cell) => {
          initial[row.cloId][cell.ploId] = cell.percentage ?? 0;
        });
      });
      setMatrixState(initial);
      setHasChanges(false);
    } catch (error) {
      showAlert("Error", error.message || "Failed to load CLO-PLO matrix.");
    } finally {
      setLoading(false);
    }
  }, [offeredCourseId, teacherUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const plos = matrix?.plos || [];
  const clos = matrix?.clos || [];
  const programCourseId = matrix?.programCourseId || course?.programCourseId;

  // Calculate live PLO column totals
  const liveTotals = {};
  plos.forEach((plo) => {
    let sum = 0;
    clos.forEach((clo) => {
      const val = Number(matrixState[clo.cloId]?.[plo.ploId] ?? 0);
      sum += Number.isNaN(val) ? 0 : val;
    });
    liveTotals[plo.ploId] = Math.round(sum * 100) / 100;
  });

  const handleCellChange = (cloId, ploId, rawVal) => {
    if (!canManage) return;

    let num = parseFloat(rawVal);
    if (Number.isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > 100) num = 100;

    setMatrixState((prev) => ({
      ...prev,
      [cloId]: {
        ...(prev[cloId] || {}),
        [ploId]: num,
      },
    }));
    setHasChanges(true);
  };

  const handleSaveChanges = async () => {
    if (!canManage) {
      showAlert("Permission Denied", "Only teachers authorized by HOD can edit CLO-PLO mapping.");
      return;
    }

    if (!programCourseId) return;

    // Check if any PLO total exceeds 100%
    for (const plo of plos) {
      if (liveTotals[plo.ploId] > 100.01) {
        showAlert(
          "Validation Error",
          `${plo.ploCode} total is currently ${liveTotals[plo.ploId]}%. PLO total cannot exceed 100%. Please reduce percentages before saving.`
        );
        return;
      }
    }

    const confirmed = await showConfirm(
      "Save CLO-PLO Mapping",
      "Do you want to save these CLO-PLO mapping percentages?"
    );
    if (!confirmed) return;

    try {
      setIsSaving(true);
      const savePromises = [];

      clos.forEach((clo) => {
        plos.forEach((plo) => {
          const val = Number(matrixState[clo.cloId]?.[plo.ploId] ?? 0);
          savePromises.push(
            saveCloPloCell(programCourseId, {
              updatedByUserId: teacherUserId,
              offeredCourseId,
              cloId: clo.cloId,
              ploId: plo.ploId,
              percentage: val,
            })
          );
        });
      });

      await Promise.all(savePromises);
      showAlert("Saved", "CLO-PLO mapping saved as draft.");
      await loadData();
    } catch (err) {
      showAlert("Error", err.message || "Failed to save CLO-PLO mapping.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!canManage) {
      showAlert("Permission Denied", "Only teachers authorized by HOD can submit CLO-PLO mapping.");
      return;
    }

    if (!programCourseId) return;

    const confirmed = await showConfirm(
      "Submit for HOD Approval",
      "Submit this CLO-PLO mapping to HOD for approval? Once approved, it will unlock assessment creation and be shared with other teachers."
    );
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      await submitContentForReview(programCourseId, {
        teacherUserId,
        offeredCourseId,
        contentTypeCode: "CloPloMapping",
      });

      showAlert(
        "Submitted",
        "CLO-PLO mapping submitted to HOD for approval! You will be notified once HOD reviews it."
      );
      await loadData();
    } catch (err) {
      showAlert("Error", err.message || "Failed to submit CLO-PLO mapping for review.");
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

  const courseTitle = course?.courseTitle || "Course";
  const contentStatus = matrix?.contentStatus || "Draft";
  const isApproved = contentStatus === "Approved" || contentStatus === "approved";
  const isPending = contentStatus === "PendingReview" || contentStatus === "Submitted";
  const isRejected = contentStatus === "Rejected";

  return (
    <div className="relative min-h-full bg-page pb-12">
      {/* Standard Header Bar */}
      <div className="border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8 dark:border-[#1b2c2e] dark:bg-[#071113]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <PageBackButton className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-semibold text-gray-900 dark:text-white">
                CLO-PLO Mapping
              </h1>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {courseTitle}
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
        {/* Info Banner */}
        {canManage ? (
          <div className="rounded-xl border border-emerald-800/20 bg-[#f4fbf7] p-4 text-xs sm:text-sm font-medium text-[#15803d] shadow-sm dark:bg-[#091816] dark:text-emerald-300 dark:border-emerald-800/30">
            1) Fill cell percentages (CLOs as rows, PLOs as columns). 2) Click <strong>Save Mapping</strong>. 3) Click <strong>Upload for HOD Approval</strong> to notify HOD. Once approved, other teachers can view it and assessment creation is unlocked.
          </div>
        ) : (
          <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-4 text-xs sm:text-sm font-medium text-blue-900 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200">
            View-only: CLO-PLO mapping is managed by the teacher authorized by HOD. Mappings are hidden until approved by HOD.
          </div>
        )}

        {/* Matrix Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#15803d] text-white dark:bg-[#14482b]">
                  <th className="py-3.5 px-4 text-xs font-black uppercase tracking-wider text-center">CLO</th>
                  {plos.map((plo) => (
                    <th
                      key={plo.ploId}
                      title={plo.ploDescription}
                      className="py-3.5 px-4 text-xs font-black uppercase tracking-wider text-center"
                    >
                      {plo.ploCode}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#1b2c2e]">
                {clos.map((clo, rIdx) => (
                  <tr
                    key={clo.cloId}
                    className={rIdx % 2 === 0 ? "bg-white dark:bg-[#0c181a]" : "bg-gray-50/50 dark:bg-[#091517]"}
                  >
                    <td
                      title={clo.cloDescription}
                      className="py-3.5 px-4 text-xs sm:text-sm font-extrabold text-[#15803d] dark:text-[#34d399] text-center"
                    >
                      {clo.cloCode}
                    </td>
                    {plos.map((plo) => {
                      const currentVal = matrixState[clo.cloId]?.[plo.ploId] ?? 0;
                      return (
                        <td key={plo.ploId} className="py-2.5 px-2 text-center">
                          {canManage ? (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={currentVal}
                              onChange={(e) => handleCellChange(clo.cloId, plo.ploId, e.target.value)}
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
                  {plos.map((plo) => {
                    const tot = liveTotals[plo.ploId] ?? 0;
                    const isExceeded = tot > 100.01;
                    return (
                      <td
                        key={plo.ploId}
                        className={`py-3.5 px-4 text-xs sm:text-sm font-black text-center ${
                          isExceeded
                            ? "text-red-700 bg-red-100/90 dark:bg-red-950/60 dark:text-red-300 rounded-lg"
                            : "text-amber-900 dark:text-amber-300"
                        }`}
                      >
                        {tot} {isExceeded ? "⚠️ (>100)" : "%"}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div className="flex items-center gap-2">
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="bg-[#15803d] hover:bg-[#166534] text-white font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-2xl shadow-md transition disabled:opacity-50"
                >
                  {isSaving ? "Saving…" : "Save Mapping"}
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
