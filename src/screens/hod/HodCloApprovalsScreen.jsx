import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  approvePendingClos,
  getPendingCloApprovals,
  rejectPendingClos,
} from "../../api/hodCloReviewApi";
import {
  getHodContentReviewQueue,
  approveHodSubmission,
  rejectHodSubmission,
} from "../../api/hodContentReviewApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import theme from "../../styles/theme";
import { showAlert, showConfirm } from "../../utils/dialogs";
import { getAuthUserId } from "../../utils/helpers";

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
      <div className="border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold text-gray-900">Approvals & Review Queue</h1>
        <p className="mt-0.5 text-xs text-gray-500">
          Review CLOs, CLO-PLO mappings, Task-CLO mappings, and course submissions.
        </p>
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

      {rejectTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onClick={closeRejectDialog}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900">
              Reject {rejectType === "clo" ? "CLOs" : rejectTarget.contentTypeName || "Submission"}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Tell the teacher why {rejectTarget.courseTitle} submission was rejected.
            </p>
            <textarea
              className="mt-4 min-h-[100px] w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm"
              placeholder="Rejection reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
                onClick={closeRejectDialog}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
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
