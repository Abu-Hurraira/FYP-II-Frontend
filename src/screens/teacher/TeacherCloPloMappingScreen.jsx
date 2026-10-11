import React, { useCallback, useContext, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  getCloPloMatrix,
  saveCloPloCell,
  submitContentForReview,
  getCourseMenu,
  getContentStatuses,
} from "../../api/teacherApi";
import { getOfferedCourseUploadPermissions } from "../../api/hodUploadAllocationApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showConfirm, showAlert } from "../../utils/dialogs";
import { canManageCloPloFromPermissions, pickContentTypeStatus, pickHodFeedback } from "../../utils/uploadAllocationHelpers";
import { HodRejectionBanner, useHodRejectionAlert } from "../../components/HodRejectionNotice.jsx";
import PercentInput from "../../components/PercentInput.jsx";

function normalizeCloPloMatrix(raw) {
  if (!raw || typeof raw !== "object") return { plos: [], clos: [] };
  const plos = (raw.plos ?? raw.Plos ?? []).map((p) => ({
    ploId: p.ploId ?? p.PloId,
    ploCode: p.ploCode ?? p.PloCode ?? "",
    ploDescription: p.ploDescription ?? p.PloDescription ?? "",
  }));
  const clos = (raw.clos ?? raw.Clos ?? []).map((c) => ({
    cloId: c.cloId ?? c.CloId,
    cloCode: c.cloCode ?? c.CloCode ?? "",
    cloDescription: c.cloDescription ?? c.CloDescription ?? "",
    cells: (c.cells ?? c.Cells ?? []).map((cell) => ({
      ploId: cell.ploId ?? cell.PloId,
      percentage: Number(cell.percentage ?? cell.Percentage ?? 0),
    })),
  }));
  return {
    ...raw,
    programCourseId: raw.programCourseId ?? raw.ProgramCourseId,
    contentStatus: raw.contentStatus ?? raw.ContentStatus ?? "Draft",
    plos,
    clos,
  };
}

export default function TeacherCloPloMappingScreen({ embedded = false }) {
  const { user } = useContext(AuthContext);
  const { offeredCourseId: ocParam } = useParams();
  const offeredCourseId = Number(ocParam);

  const [searchParams] = useSearchParams();
  const routeTeacher = searchParams.get("teacherUserId");
  const teacherUserId =
    routeTeacher != null && routeTeacher !== ""
      ? Number(routeTeacher) || user?.userId
      : user?.userId;

  const [matrix, setMatrix] = useState(null);
  const [course, setCourse] = useState(null);
  const [uploadPermissions, setUploadPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  // Editable matrix state: { [cloId]: { [ploId]: number } }
  const [matrixState, setMatrixState] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [hodFeedback, setHodFeedback] = useState("");

  const isHod = user?.roleName === "HOD" || user?.role?.roleName === "HOD";
  const canManage = isHod || canManageCloPloFromPermissions(uploadPermissions);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const cData = await getCourseMenu(offeredCourseId);
      setCourse(cData);

      const pCourseId = cData?.programCourseId ?? cData?.ProgramCourseId;
      if (!pCourseId) {
        showAlert("Error", "Program course info missing.");
        return;
      }

      const [matrixRes, permissions, statuses] = await Promise.all([
        getCloPloMatrix(pCourseId, teacherUserId, offeredCourseId),
        getOfferedCourseUploadPermissions(offeredCourseId, teacherUserId).catch(() => ({
          clos: false,
          cloPloMapping: false,
          configured: false,
        })),
        getContentStatuses(pCourseId, teacherUserId, offeredCourseId).catch(() => []),
      ]);

      const normalized = normalizeCloPloMatrix(matrixRes);
      normalized.contentStatus = pickContentTypeStatus(
        statuses,
        "CloPloMapping",
        normalized.contentStatus
      );
      setHodFeedback(pickHodFeedback(statuses, "CloPloMapping"));
      setMatrix(normalized);
      setUploadPermissions(permissions);

      const initial = {};
      (normalized.clos || []).forEach((row) => {
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
      const val = Number(matrixState[clo.cloId]?.[plo.ploId] || 0);
      sum += Number.isNaN(val) ? 0 : val;
    });
    liveTotals[plo.ploId] = Math.round(sum * 100) / 100;
  });

  const handleCellChange = (cloId, ploId, rawVal) => {
    if (!canManage) return;

    const next = Number(rawVal) || 0;
    setMatrixState((prev) => {
      const row = { ...(prev[cloId] || {}) };
      // Each CLO maps to exactly one PLO — clearing other columns when a value is set.
      if (next > 0) {
        for (const key of Object.keys(row)) {
          row[key] = 0;
        }
      }
      row[ploId] = rawVal;
      return { ...prev, [cloId]: row };
    });
    setHasChanges(true);
  };

  const cloHasMultiplePlos = (cloId) => {
    const row = matrixState[cloId] || {};
    return Object.values(row).filter((v) => Number(v) > 0).length > 1;
  };

  const cloMappedPloCount = (cloId) => {
    const row = matrixState[cloId] || {};
    return Object.values(row).filter((v) => Number(v) > 0).length;
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

    for (const clo of clos) {
      const mapped = cloMappedPloCount(clo.cloId);
      if (mapped > 1) {
        showAlert(
          "Validation Error",
          `${clo.cloCode} is mapped to more than one PLO. One CLO may link to only one PLO (a PLO can still have many CLOs).`
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

      // Per CLO: save the active PLO first, then clear other cells (avoids race on one-CLO→one-PLO).
      for (const clo of clos) {
        const active = plos.filter((plo) => Number(matrixState[clo.cloId]?.[plo.ploId] || 0) > 0);
        const inactive = plos.filter((plo) => Number(matrixState[clo.cloId]?.[plo.ploId] || 0) <= 0);
        for (const plo of active) {
          await saveCloPloCell(programCourseId, {
            updatedByUserId: teacherUserId,
            offeredCourseId,
            cloId: clo.cloId,
            ploId: plo.ploId,
            percentage: Number(matrixState[clo.cloId]?.[plo.ploId] || 0),
          });
        }
        for (const plo of inactive) {
          await saveCloPloCell(programCourseId, {
            updatedByUserId: teacherUserId,
            offeredCourseId,
            cloId: clo.cloId,
            ploId: plo.ploId,
            percentage: 0,
          });
        }
      }

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

    for (const clo of clos) {
      const mapped = cloMappedPloCount(clo.cloId);
      if (mapped === 0) {
        showAlert(
          "Validation Error",
          `${clo.cloCode} has no PLO. Map this CLO to one PLO before submitting (a PLO may still have many CLOs).`
        );
        return;
      }
      if (mapped > 1) {
        showAlert(
          "Validation Error",
          `${clo.cloCode} is mapped to more than one PLO. One CLO may link to only one PLO (a PLO can still have many CLOs).`
        );
        return;
      }
    }

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

  const courseTitle = course?.courseTitle || "Course";
  const contentStatus = String(matrix?.contentStatus || "Draft");
  const statusKey = contentStatus.toLowerCase();
  const isApproved = statusKey === "approved";
  const isPending = statusKey === "pendingreview" || statusKey === "submitted";
  const isRejected = statusKey === "rejected";
  const canEdit = canManage && !isApproved && !isPending;
  useHodRejectionAlert(!loading && isRejected, "CLO-PLO mapping", hodFeedback);

  const statusBadge = isApproved ? (
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
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-page">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand dark:border-gray-800 dark:border-t-brand" />
      </div>
    );
  }

  return (
    <div className={embedded ? "pb-4" : "relative min-h-full bg-page pb-12"}>
      {embedded ? (
        <div className="mb-3 flex justify-end">{statusBadge}</div>
      ) : (
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
            {statusBadge}
          </div>
        </div>
      )}

      <div className={embedded ? "space-y-4" : "w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8 space-y-4"}>
        {/* Info Banner */}
        {isPending ? (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 text-xs sm:text-sm font-medium text-amber-900 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300">
            Submitted to HOD. Editing is locked until the HOD approves or rejects this mapping.
          </div>
        ) : isRejected ? (
          <HodRejectionBanner title="CLO-PLO mapping" reason={hodFeedback} />
        ) : isApproved ? (
          <div className="rounded-xl border border-emerald-800/20 bg-[#f4fbf7] p-4 text-xs sm:text-sm font-medium text-[#15803d] shadow-sm dark:bg-[#091816] dark:text-emerald-300 dark:border-emerald-800/30">
            Approved by HOD. This mapping is locked and shared with other sections of this subject.
          </div>
        ) : canManage ? (
          <div className="rounded-xl border border-emerald-800/20 bg-[#f4fbf7] p-4 text-xs sm:text-sm font-medium text-[#15803d] shadow-sm dark:bg-[#091816] dark:text-emerald-300 dark:border-emerald-800/30">
            Rule: <strong>one CLO → one PLO</strong> (entering a % on another PLO clears the previous). A PLO may be fulfilled by <strong>many CLOs</strong> (column total ≤ 100%). Then <strong>Save Mapping</strong> and <strong>Upload for HOD Approval</strong>.
          </div>
        ) : (
          <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-4 text-xs sm:text-sm font-medium text-blue-900 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200">
            View-only: CLO-PLO mapping is managed by the teacher authorized by HOD. After they save
            and HOD approves, the mapping is shared with every other section of this subject.
          </div>
        )}

        {/* Matrix Table */}
        {clos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center shadow-card dark:border-[#1b2c2e] dark:bg-[#0c181a]">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Add CLOs for this course first, then return here to map them to PLOs.
            </p>
          </div>
        ) : plos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center shadow-card dark:border-[#1b2c2e] dark:bg-[#0c181a]">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              No PLOs were found for this program, so the mapping grid has no columns.
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Ask HOD to add program PLOs, then refresh this page.
            </p>
          </div>
        ) : (
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
                {clos.map((clo, rIdx) => {
                  const multi = cloHasMultiplePlos(clo.cloId);
                  return (
                  <tr
                    key={clo.cloId}
                    className={
                      multi
                        ? "bg-red-50/80 dark:bg-red-950/30"
                        : rIdx % 2 === 0
                          ? "bg-white dark:bg-[#0c181a]"
                          : "bg-gray-50/50 dark:bg-[#091517]"
                    }
                  >
                    <td
                      title={clo.cloDescription}
                      className="py-3.5 px-4 text-xs sm:text-sm font-extrabold text-[#15803d] dark:text-[#34d399] text-center"
                    >
                      {clo.cloCode}
                      {multi ? (
                        <span className="mt-1 block text-[10px] font-bold text-red-600">1 PLO only</span>
                      ) : null}
                    </td>
                    {plos.map((plo) => {
                      const currentVal = matrixState[clo.cloId]?.[plo.ploId] ?? 0;
                      return (
                        <td key={plo.ploId} className="py-2.5 px-2 text-center">
                          {canEdit ? (
                            <PercentInput
                              value={currentVal}
                              onChange={(next) => handleCellChange(clo.cloId, plo.ploId, next)}
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
                  );
                })}
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
        )}

        {canEdit && (
        <div className="flex flex-wrap items-center gap-3 pt-4">
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
        </div>
        )}
      </div>
    </div>
  );
}
