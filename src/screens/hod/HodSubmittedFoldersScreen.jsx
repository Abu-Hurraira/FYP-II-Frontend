import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getHodSubmittedFolders } from "../../api/hodApi";
import { approveSubmittedFolder, rejectSubmittedFolder, unlockSubmittedFolder } from "../../api/hodFolderReviewApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import { useHodProgram } from "../../context/HodProgramContext.jsx";
import theme from "../../styles/theme";
import { showAlert, showConfirm } from "../../utils/dialogs";
import { getAuthUserId } from "../../utils/helpers";
import HodMintHeader from "../../components/HodMintHeader.jsx";

function isApprovedFolder(item) {
  return String(item.reviewStatus ?? "").toLowerCase() === "approved";
}

export default function HodSubmittedFoldersScreen() {
  const { user } = useContext(AuthContext);
  const { selectedProgramId, selectedProgram } = useHodProgram();
  const hodUserId = getAuthUserId(user);
  const navigate = useNavigate();
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadFolders = useCallback(async () => {
    try {
      setLoading(true);
      if (!hodUserId || !selectedProgramId) {
        setFolders([]);
        return;
      }
      const data = await getHodSubmittedFolders(hodUserId, { programId: selectedProgramId });
      setFolders(Array.isArray(data) ? data : []);
    } catch (error) {
      setFolders([]);
      showAlert("Error", error.message || "Could not load submitted folders.");
    } finally {
      setLoading(false);
    }
  }, [hodUserId, selectedProgramId]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const handleApprove = async (item) => {
    if (!hodUserId) {
      showAlert("Error", "HOD user not found.");
      return;
    }

    const label = [item.courseTitle, item.sectionName].filter(Boolean).join(" · ");
    if (
      !(await showConfirm(
        "Approve Folder",
        `Approve the submitted folder for ${label || "this course"}?`
      ))
    ) {
      return;
    }

    try {
      setActionId(item.offeredCourseId);
      await approveSubmittedFolder(item.offeredCourseId, hodUserId);
      showAlert("Approved", "Folder approved successfully.");
      await loadFolders();
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setActionId(null);
    }
  };

  const openRejectDialog = (item) => {
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
      setActionId(rejectTarget.offeredCourseId);
      await rejectSubmittedFolder(rejectTarget.offeredCourseId, hodUserId, rejectReason.trim());
      showAlert("Rejected", "Folder rejected. The teacher has been notified and can edit again.");
      closeRejectDialog();
      await loadFolders();
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="min-h-full bg-page">
      <HodMintHeader
        title="Submitted Folders"
        subtitle={
          selectedProgram
            ? `Review submitted folders for ${selectedProgram.programCode || selectedProgram.programName}.`
            : "Select a program from the top bar to review submitted folders."
        }
      />

      <div className="w-full px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : folders.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">
            No submitted folders yet. Folders appear here after teachers submit them.
          </p>
        ) : (
          <div className="space-y-2.5">
            {folders.map((item) => {
              const busy = actionId === item.offeredCourseId;
              const approved = isApprovedFolder(item);
              return (
                <article
                  key={item.offeredCourseId}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-card shadow-sm ${
                    approved
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-gray-100 bg-white"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{item.teacherName || "Teacher"}</p>
                      {approved ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          Approved
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                          Pending review
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-gray-600">
                      {[item.sectionName, item.courseTitle].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {item.programName ? (
                      <p className="mt-0.5 text-xs text-gray-500">{item.programName}</p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {!approved ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleApprove(item)}
                          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {busy ? "…" : "Approve"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openRejectDialog(item)}
                          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          if (!(await showConfirm("Unlock Folder", "Unlock this approved folder so the teacher can revise?"))) return;
                          try {
                            setActionId(item.offeredCourseId);
                            await unlockSubmittedFolder(item.offeredCourseId, hodUserId);
                            showAlert("Unlocked", "Folder unlocked for the teacher.");
                            await loadFolders();
                          } catch (error) {
                            showAlert("Error", error.message);
                          } finally {
                            setActionId(null);
                          }
                        }}
                        className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-60"
                      >
                        Unlock
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => navigate(`/hod/submitted-folders/${item.offeredCourseId}`)}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-brand-muted/40 disabled:opacity-60"
                    >
                      View
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {rejectTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-6 backdrop-blur-xs"
          onClick={closeRejectDialog}
          role="presentation"
        >
          <div
            className="max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 shadow-xl dark:bg-[#0c181a] dark:text-white"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Review</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {[rejectTarget.courseTitle, rejectTarget.sectionName].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              The folder will be unlocked. Your reason will show on the teacher’s folder page.
            </p>

            <label className="mt-4 block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Reason
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-2 min-h-[110px] w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm font-normal text-gray-900 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                placeholder="Write why you are rejecting this…"
                autoFocus
              />
            </label>

            <button
              type="button"
              onClick={handleRejectSubmit}
              disabled={actionId === rejectTarget.offeredCourseId}
              className="mt-4 min-h-[44px] w-full rounded-xl bg-red-600 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {actionId === rejectTarget.offeredCourseId ? "Rejecting…" : "Submit Rejection"}
            </button>
            <button
              type="button"
              onClick={closeRejectDialog}
              className="mt-3 min-h-[44px] w-full font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
