import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  approvePendingClos,
  getPendingCloApprovals,
  rejectPendingClos,
} from "../../api/hodCloReviewApi";
import {
  getHodContentReviewQueue,
  getHodSubmissionDetails,
  approveHodSubmission,
  rejectHodSubmission,
} from "../../api/hodContentReviewApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import theme from "../../styles/theme";
import { showAlert, showConfirm } from "../../utils/dialogs";
import { getAuthUserId } from "../../utils/helpers";

function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj?.[key] != null) return obj[key];
  }
  return undefined;
}

function SubmissionDetailsBody({ details }) {
  if (!details) return null;

  const clos = pick(details, "clos", "Clos") || [];
  const weeks = pick(details, "weeks", "Weeks") || [];
  const cloPlo = pick(details, "cloPloMatrix", "CloPloMatrix");
  const cloTask = pick(details, "cloTaskMatrix", "CloTaskMatrix");

  if (clos.length) {
    return (
      <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
        {clos.map((clo) => (
          <div
            key={pick(clo, "cloId", "CloId")}
            className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
          >
            <span className="mr-2 inline-block rounded-full bg-lime-100 px-2 py-0.5 text-xs font-semibold text-green-800">
              {pick(clo, "cloCode", "CloCode")}
            </span>
            <span className="text-sm text-gray-800">
              {pick(clo, "cloDescription", "CloDescription")}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (weeks.length) {
    return (
      <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
        {weeks.map((week) => (
          <div
            key={pick(week, "topicId", "TopicId", "weekNo", "WeekNo")}
            className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
          >
            <span className="font-semibold">Week {pick(week, "weekNo", "WeekNo")}</span>
            <span className="ml-2 text-gray-700">{pick(week, "topicName", "TopicName")}</span>
          </div>
        ))}
      </div>
    );
  }

  if (cloPlo) {
    const plos = pick(cloPlo, "plos", "Plos") || [];
    const rows = pick(cloPlo, "clos", "Clos") || [];
    return (
      <div className="mt-4 max-h-80 overflow-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-2 text-left">CLO</th>
              {plos.map((p) => (
                <th key={pick(p, "ploId", "PloId")} className="px-2 py-2">
                  {pick(p, "ploCode", "PloCode")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const cells = pick(row, "cells", "Cells") || [];
              return (
                <tr key={pick(row, "cloId", "CloId")} className="border-t border-gray-100">
                  <td className="px-2 py-2 font-bold">{pick(row, "cloCode", "CloCode")}</td>
                  {plos.map((p) => {
                    const ploId = pick(p, "ploId", "PloId");
                    const cell = cells.find(
                      (c) => Number(pick(c, "ploId", "PloId")) === Number(ploId)
                    );
                    const pct = pick(cell, "percentage", "Percentage");
                    return (
                      <td key={ploId} className="px-2 py-2 text-center">
                        {pct != null ? Number(pct) : "–"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (cloTask) {
    const types = pick(cloTask, "assessmentTypes", "AssessmentTypes") || [];
    const rows = pick(cloTask, "clos", "Clos") || [];
    return (
      <div className="mt-4 max-h-80 overflow-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-2 text-left">CLO</th>
              {types.map((t) => (
                <th key={pick(t, "assessmentTypeId", "AssessmentTypeId")} className="px-2 py-2">
                  {pick(t, "columnLabel", "ColumnLabel") ||
                    pick(t, "assessmentTypeName", "AssessmentTypeName")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const cells = pick(row, "cells", "Cells") || [];
              return (
                <tr key={pick(row, "cloId", "CloId")} className="border-t border-gray-100">
                  <td className="px-2 py-2 font-bold">{pick(row, "cloCode", "CloCode")}</td>
                  {types.map((t) => {
                    const typeId = pick(t, "assessmentTypeId", "AssessmentTypeId");
                    const cell = cells.find(
                      (c) => Number(pick(c, "assessmentTypeId", "AssessmentTypeId")) === Number(typeId)
                    );
                    const pct = pick(cell, "percentage", "Percentage");
                    return (
                      <td key={typeId} className="px-2 py-2 text-center">
                        {pct != null ? Number(pct) : "–"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const exams = pick(details, "exams", "Exams") || [];
  if (exams.length) {
    return (
      <div className="mt-4 max-h-80 space-y-3 overflow-auto">
        {exams.map((exam) => (
          <div
            key={pick(exam, "assessmentId", "AssessmentId")}
            className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
          >
            <p className="text-sm font-bold text-gray-900">
              {pick(exam, "title", "Title")}{" "}
              {pick(exam, "totalMarks", "TotalMarks") != null
                ? `· ${pick(exam, "totalMarks", "TotalMarks")} marks`
                : ""}
            </p>
            {(pick(exam, "questions", "Questions") || []).map((q, idx) => {
              const cloCodes = pick(q, "cloCodes", "CloCodes") || [];
              return (
              <p key={idx} className="mt-1 text-xs text-gray-700">
                <span className="font-semibold">{pick(q, "questionNo", "QuestionNo")}: </span>
                {pick(q, "questionText", "QuestionText")}
                {pick(q, "marks", "Marks") != null ? ` (${pick(q, "marks", "Marks")} marks)` : ""}
                {cloCodes.length ? ` · ${cloCodes.join(", ")}` : ""}
              </p>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  return (
    <p className="mt-4 text-sm text-gray-500">
      No detailed payload for this content type ({pick(details, "itemCount", "ItemCount") ?? 0}{" "}
      item(s)).
    </p>
  );
}

export default function HodCloApprovalsScreen() {
  const { user } = useContext(AuthContext);
  const hodUserId = getAuthUserId(user);
  const [groups, setGroups] = useState([]);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectType, setRejectType] = useState("clo"); // "clo" or "submission"
  const [rejectReason, setRejectReason] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsData, setDetailsData] = useState(null);

  const loadPending = useCallback(async () => {
    try {
      setLoading(true);
      const [cloData, queueData] = await Promise.all([
        getPendingCloApprovals().catch(() => []),
        hodUserId ? getHodContentReviewQueue(hodUserId).catch(() => []) : Promise.resolve([]),
      ]);
      setGroups(cloData || []);
      setReviewQueue(queueData || []);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [hodUserId]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const handleApproveClo = async (item) => {
    if (!hodUserId) {
      showAlert("Error", "HOD user not found.");
      return;
    }

    if (
      !(await showConfirm(
        "Approve CLOs",
        `Approve ${item.pendingCount} CLO(s) for ${item.courseTitle}? They will become visible to all teachers of this subject.`
      ))
    ) {
      return;
    }

    try {
      setActionId(`clo-${item.programCourseId}`);
      await approvePendingClos(item.programCourseId, hodUserId);
      showAlert("Approved", "CLOs approved and shared with subject teachers.");
      await loadPending();
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setActionId(null);
    }
  };

  const handleApproveSubmission = async (item) => {
    if (!hodUserId) {
      showAlert("Error", "HOD user not found.");
      return;
    }

    if (
      !(await showConfirm(
        "Approve Submission",
        `Approve ${item.contentTypeName || item.contentTypeCode} for ${item.courseTitle}? This will unlock assessment flows for all teachers of this subject.`
      ))
    ) {
      return;
    }

    try {
      setActionId(`sub-${item.submissionId}`);
      await approveHodSubmission(item.submissionId, hodUserId);
      showAlert("Approved", `${item.contentTypeName || "Submission"} approved successfully.`);
      await loadPending();
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setActionId(null);
    }
  };

  const openRejectCloDialog = (item) => {
    setRejectType("clo");
    setRejectTarget(item);
    setRejectReason("");
  };

  const openRejectSubmissionDialog = (item) => {
    setRejectType("submission");
    setRejectTarget(item);
    setRejectReason("");
  };

  const openSubmissionDetails = async (item) => {
    if (!hodUserId) {
      showAlert("Error", "HOD user not found.");
      return;
    }
    setDetailsOpen(item);
    setDetailsData(null);
    setDetailsLoading(true);
    try {
      const data = await getHodSubmissionDetails(item.submissionId, hodUserId);
      setDetailsData(data);
    } catch (error) {
      showAlert("Details", error.message);
      setDetailsOpen(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setDetailsOpen(null);
    setDetailsData(null);
  };

  const closeRejectDialog = () => {
    setRejectTarget(null);
    setRejectReason("");
  };

  const handleRejectSubmit = async () => {
    if (!rejectTarget) return;
    if (!hodUserId) {
      showAlert("Error", "HOD user not found.");
      return;
    }
    if (!rejectReason.trim()) {
      showAlert("Validation", "Please enter a rejection reason for the teacher.");
      return;
    }

    try {
      if (rejectType === "clo") {
        setActionId(`clo-${rejectTarget.programCourseId}`);
        await rejectPendingClos(rejectTarget.programCourseId, hodUserId, rejectReason.trim());
        showAlert("Rejected", "CLOs rejected. The teacher has been notified.");
      } else {
        setActionId(`sub-${rejectTarget.submissionId}`);
        await rejectHodSubmission(rejectTarget.submissionId, hodUserId, rejectReason.trim());
        showAlert("Rejected", "Submission rejected. The teacher has been notified.");
      }
      closeRejectDialog();
      await loadPending();
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setActionId(null);
    }
  };

  const totalPending = groups.length + reviewQueue.length;

  return (
    <div className="min-h-full bg-page">
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton className="mt-0.5 shrink-0" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Approvals & Review Queue</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            Review CLOs, CLO-PLO mappings, Task-CLO mappings, and course submissions.
          </p>
        </div>
      </div>

      <div className="w-full px-4 pb-8 pt-4 sm:px-6 lg:px-8 space-y-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : totalPending === 0 ? (
          <p className="rounded-2xl border border-gray-100 bg-white px-4 py-10 text-center text-sm text-gray-500 shadow-sm">
            No pending approvals or content submissions right now.
          </p>
        ) : (
          <>
            {/* Content Submissions Section (CLO-PLO Mappings, Task-CLO Mappings, etc.) */}
            {reviewQueue.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">
                  Content Submissions ({reviewQueue.length})
                </h2>
                {reviewQueue.map((item) => {
                  const busy = actionId === `sub-${item.submissionId}`;
                  return (
                    <div
                      key={item.submissionId}
                      className="rounded-2xl border border-purple-100 bg-white p-4 shadow-sm sm:p-5 dark:border-purple-900/30"
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-gray-900">
                              {item.courseTitle}
                            </h3>
                            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-900 dark:bg-purple-950 dark:text-purple-300">
                              {item.contentTypeName || item.contentTypeCode}
                            </span>
                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                              Pending Review
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {[item.courseCode, item.programName, item.sessionTitle]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="mt-1 text-sm text-gray-600">
                            Submitted by <strong>{item.submittedByName}</strong>
                            {item.submittedAt
                              ? ` · ${new Date(item.submittedAt).toLocaleString()}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-brand-muted/40 disabled:opacity-50"
                            onClick={() => openSubmissionDetails(item)}
                          >
                            View details
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className="app-btn-primary disabled:opacity-50"
                            onClick={() => handleApproveSubmission(item)}
                          >
                            {busy ? "…" : "Approve"}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                            onClick={() => openRejectSubmissionDialog(item)}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* CLO Pending Approvals Section */}
            {groups.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">
                  CLO Approvals ({groups.length})
                </h2>
                {groups.map((item) => {
                  const busy = actionId === `clo-${item.programCourseId}`;
                  const expanded = expandedId === item.programCourseId;
                  return (
                    <div
                      key={item.programCourseId}
                      className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5"
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-gray-900">
                              {item.courseTitle}
                            </h3>
                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                              Pending · {item.pendingCount} CLO(s)
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {[item.courseCode, item.programName].filter(Boolean).join(" · ")}
                          </p>
                          <p className="mt-1 text-sm text-gray-600">
                            Uploaded by {item.submittedByName}
                            {item.submittedAt
                              ? ` · ${new Date(item.submittedAt).toLocaleString()}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-brand-muted/40"
                            onClick={() =>
                              setExpandedId(expanded ? null : item.programCourseId)
                            }
                          >
                            {expanded ? "Hide CLOs" : "View CLOs"}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className="app-btn-primary disabled:opacity-50"
                            onClick={() => handleApproveClo(item)}
                          >
                            {busy ? "…" : "Approve"}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                            onClick={() => openRejectCloDialog(item)}
                          >
                            Reject
                          </button>
                        </div>
                      </div>

                      {expanded ? (
                        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                          {(item.clos || []).map((clo) => (
                            <div
                              key={clo.cloId}
                              className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
                            >
                              <span className="mr-2 inline-block rounded-full bg-lime-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                                {clo.cloCode}
                              </span>
                              <span className="text-sm text-gray-800">
                                {clo.cloDescription}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {detailsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-4 backdrop-blur-xs"
          role="presentation"
          onClick={closeDetails}
        >
          <div
            className="max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-xl dark:bg-[#0c181a] dark:text-white"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {detailsOpen.contentTypeName || detailsOpen.contentTypeCode || "Submission"}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {detailsOpen.courseTitle}
              {detailsOpen.submittedByName ? ` · ${detailsOpen.submittedByName}` : ""}
            </p>
            {detailsLoading ? (
              <div className="flex justify-center py-12">
                <div
                  className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
                  style={{ borderTopColor: theme.colors.primary }}
                />
              </div>
            ) : (
              <SubmissionDetailsBody details={detailsData} />
            )}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="min-h-[44px] rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                onClick={closeDetails}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-4 backdrop-blur-xs"
          role="presentation"
          onClick={closeRejectDialog}
        >
          <div
            className="max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 shadow-xl dark:bg-[#0c181a] dark:text-white"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Review</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Write the reason so the teacher can see why {rejectTarget.courseTitle} was rejected.
            </p>
            <label className="mt-4 block text-sm font-semibold text-gray-800 dark:text-gray-200">
              Reason
              <textarea
                className="mt-2 min-h-[100px] w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm font-normal text-gray-900 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                placeholder="Write why you are rejecting this…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
              />
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="min-h-[44px] rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                onClick={closeRejectDialog}
              >
                Cancel
              </button>
              <button
                type="button"
                className="min-h-[44px] rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                onClick={handleRejectSubmit}
                disabled={Boolean(actionId)}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
