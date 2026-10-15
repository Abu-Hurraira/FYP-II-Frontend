import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  createCLO,
  deleteCLO,
  getCLOsByProgramCourse,
  importCLOs,
  submitCLOsForApproval,
  updateCLO,
} from "../../api/closApi";
import { getOfferedCourseUploadPermissions } from "../../api/hodUploadAllocationApi";
import { getCourseMenu, getContentStatuses } from "../../api/teacherApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import AddHeaderButton from "../../components/AddHeaderButton.jsx";
import ListRowActions from "../../components/ListRowActions.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import theme from "../../styles/theme";
import {
  getArchiveId,
  isOldOutcome,
} from "../../utils/outcomeArchivedView";
import { extractOutcomeNumber, sortClos } from "../../utils/outcomeHelpers";
import { showAlert, showConfirm } from "../../utils/dialogs";
import { getAuthUserId } from "../../utils/helpers";
import { canManageClosFromPermissions, filterClosForViewer, getCloApprovalStatus, pickContentTypeStatus, pickHodFeedback } from "../../utils/uploadAllocationHelpers";
import { HodRejectionBanner, useHodRejectionAlert } from "../../components/HodRejectionNotice.jsx";

const CLO_MAX_COUNT = 20;

function getNextCloCode(existingItems) {
  const used = new Set();
  for (const item of existingItems) {
    const n = extractOutcomeNumber(item.cloCode);
    if (n != null) used.add(n);
  }
  for (let i = 1; i <= CLO_MAX_COUNT; i++) {
    if (!used.has(i)) return `CLO${i}`;
  }
  return null;
}

function approvalBadgeClass(status) {
  const s = String(status || "Draft").toLowerCase();
  if (s === "approved") return "bg-emerald-100 text-emerald-800";
  if (s === "pending") return "bg-amber-100 text-amber-900";
  if (s === "rejected") return "bg-red-50 text-red-800";
  return "bg-gray-100 text-gray-700";
}

export default function TeacherClosScreen() {
  const { user } = useContext(AuthContext);
  const teacherUserId = getAuthUserId(user);
  const { offeredCourseId: ocParam } = useParams();
  const offeredCourseId = Number(ocParam);
  const [searchParams] = useSearchParams();
  const courseTitleParam = searchParams.get("courseTitle") || "";

  const [course, setCourse] = useState(null);
  const [items, setItems] = useState([]);
  const [contentStatuses, setContentStatuses] = useState([]);
  const [uploadPermissions, setUploadPermissions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const canManage = canManageClosFromPermissions(uploadPermissions);
  const isAllocatedTeacher = Boolean(
    uploadPermissions?.isAllocatedTeacher ?? uploadPermissions?.IsAllocatedTeacher
  );
  const canSeeDrafts = canManage || isAllocatedTeacher;
  const programCourseId = course?.programCourseId ?? course?.ProgramCourseId;

  const draftOrRejectedCount = useMemo(
    () =>
      items.filter((item) => {
        if (isOldOutcome(item)) return false;
        const status = getCloApprovalStatus(item);
        return status === "draft" || status === "rejected";
      }).length,
    [items]
  );

  const pendingCount = useMemo(
    () =>
      items.filter((item) => {
        return getCloApprovalStatus(item) === "pending";
      }).length,
    [items]
  );

  const canClickUpload = canManage && draftOrRejectedCount > 0 && !submitting;
  const cloStatus = String(pickContentTypeStatus(contentStatuses, "Clos", "Draft"));
  const cloRejected = cloStatus.toLowerCase() === "rejected" || items.some((item) => getCloApprovalStatus(item) === "rejected");
  const cloRejectReason =
    pickHodFeedback(contentStatuses, "Clos") ||
    items.map((item) => String(item.rejectionReason ?? item.RejectionReason ?? "").trim()).find(Boolean) ||
    "";
  useHodRejectionAlert(cloRejected, "CLOs", cloRejectReason, !loading);

  const loadClos = useCallback(
    async ({ includeArchived = false } = {}) => {
      if (!programCourseId) return;
      const data = await getCLOsByProgramCourse(programCourseId, {
        includeArchived,
        offeredCourseId,
        teacherUserId,
      });
      setItems(sortClos(filterClosForViewer(data || [], canManage, isAllocatedTeacher)));
      const statuses = await getContentStatuses(programCourseId, teacherUserId, offeredCourseId).catch(() => []);
      setContentStatuses(statuses || []);
    },
    [programCourseId, offeredCourseId, canManage, isAllocatedTeacher, teacherUserId]
  );

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);
      const [menu, permissions] = await Promise.all([
        getCourseMenu(offeredCourseId),
        getOfferedCourseUploadPermissions(offeredCourseId, teacherUserId).catch(() => ({
          clos: false,
          configured: false,
        })),
      ]);
      setCourse(menu);
      setUploadPermissions(permissions);
      const manage = canManageClosFromPermissions(permissions);
      const allocatedTeacher = Boolean(
        permissions?.isAllocatedTeacher ?? permissions?.IsAllocatedTeacher
      );

      const pcId = menu?.programCourseId ?? menu?.ProgramCourseId;
      if (pcId && teacherUserId) {
        const [data, statuses] = await Promise.all([
          getCLOsByProgramCourse(pcId, {
            offeredCourseId,
            teacherUserId,
          }),
          getContentStatuses(pcId, teacherUserId, offeredCourseId).catch(() => []),
        ]);
        setItems(sortClos(filterClosForViewer(data || [], manage, allocatedTeacher)));
        setContentStatuses(statuses || []);
      }
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [offeredCourseId, teacherUserId]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const activeItems = items.filter((item) => !isOldOutcome(item));
  const title = course?.courseTitle || courseTitleParam || "Course";

  const openNewForm = () => {
    setEditingItem(null);
    setDescription("");
    setActionModalVisible(false);
    setFormModalVisible(true);
  };

  const openEditForm = (item) => {
    setEditingItem(item);
    setDescription(item.cloDescription || "");
    setFormModalVisible(true);
  };

  const handleSave = async () => {
    if (!description.trim()) {
      showAlert("Validation Error", "CLO description is required.");
      return;
    }
    if (!programCourseId) {
      showAlert("Error", "Program course is missing for this subject.");
      return;
    }

    try {
      if (editingItem) {
        const archiveId = getArchiveId(editingItem);
        const editingOld = isOldOutcome(editingItem);
        await updateCLO(
          editingItem.cloId,
          {
            cloCode: editingItem.cloCode,
            cloDescription: description.trim(),
            teacherUserId,
          },
          {
            offeredCourseId,
            teacherUserId,
            ...(editingOld && archiveId ? { archiveId } : {}),
          }
        );
      } else {
        const nextCode = getNextCloCode(activeItems);
        if (!nextCode) {
          showAlert(
            "Validation Error",
            `This subject already has ${CLO_MAX_COUNT} CLOs. Remove one before adding another.`
          );
          return;
        }
        await createCLO({
          programCourseId,
          offeredCourseId,
          teacherUserId,
          cloCode: nextCode,
          cloDescription: description.trim(),
        });
      }

      setFormModalVisible(false);
      setDescription("");
      setEditingItem(null);
      await loadClos();
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const handleDelete = async (item) => {
    const isOld = isOldOutcome(item);
    const archiveId = getArchiveId(item);

    const confirmed = isOld
      ? await showConfirm(
          "Delete CLO permanently",
          "This old CLO will be removed completely from the database. This cannot be undone."
        )
      : await showConfirm(
          "Delete CLO",
          "This CLO will be deleted. You can re-add it with Add or Import Excel."
        );

    if (!confirmed) return;

    try {
      if (isOld && archiveId) {
        await deleteCLO(item.cloId, { archiveId, offeredCourseId, teacherUserId });
      } else {
        await deleteCLO(item.cloId, { offeredCourseId, teacherUserId });
      }
      await loadClos();
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!programCourseId || !teacherUserId) {
      showAlert("Error", "Unable to submit CLOs. Missing course or user. Try logging in again.");
      return;
    }
    if (draftOrRejectedCount === 0) {
      showAlert(
        "Nothing to upload",
        "Add or edit CLOs first (they save as Draft), then click Upload to send them to HOD."
      );
      return;
    }

    const confirmed = await showConfirm(
      "Upload for HOD approval",
      `Submit ${draftOrRejectedCount} CLO(s) to HOD? Other teachers will see them only after approval.`
    );
    if (!confirmed) return;

    try {
      setSubmitting(true);
      const result = await submitCLOsForApproval(programCourseId, {
        offeredCourseId,
        submittedByUserId: teacherUserId,
      });
      showAlert(
        "Submitted",
        result?.message ||
          "CLOs sent for HOD approval. The HOD will see them in Notifications (bell icon)."
      );
      await loadClos();
    } catch (error) {
      showAlert("Upload failed", error.message || "Could not submit CLOs.");
    } finally {
      setSubmitting(false);
    }
  };

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      if (!f.name?.toLowerCase().endsWith(".xlsx")) {
        showAlert("Invalid File", "Please select a .xlsx file.");
        return;
      }
      setSelectedFile(f);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      showAlert("No File", "Please select a file first.");
      return;
    }
    if (!programCourseId || !teacherUserId) {
      showAlert("Error", "Unable to import CLOs. Missing course or user. Try logging in again.");
      return;
    }

    try {
      setUploading(true);
      const result = await importCLOs(programCourseId, selectedFile, {
        offeredCourseId,
        teacherUserId,
      });
      const inserted = result.inserted ?? result.Inserted ?? result.insertedCount ?? 0;
      const skipped = result.skipped ?? result.Skipped ?? result.skippedCount ?? 0;
      showAlert(
        "Import Completed",
        `Inserted: ${inserted}\nSkipped: ${skipped}\n\nImported as drafts. Click Upload to send for HOD approval.`
      );
      setUploadModalVisible(false);
      setActionModalVisible(false);
      setSelectedFile(null);
      await loadClos();
    } catch (error) {
      showAlert("Upload Error", error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative min-h-full bg-page">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-gray-900">CLOs</h1>
          <p className="mt-0.5 text-xs text-gray-500">{title}</p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <AddHeaderButton label="Add CLO" onClick={() => setActionModalVisible(true)} />
            <button
              type="button"
              onClick={handleSubmitForApproval}
              disabled={!canClickUpload}
              className="app-btn-primary disabled:opacity-50"
              title={
                draftOrRejectedCount === 0
                  ? "Add or edit CLOs first (Draft), then Upload"
                  : `Upload ${draftOrRejectedCount} draft CLO(s) for HOD approval`
              }
            >
              {submitting ? "Uploading…" : `Upload${draftOrRejectedCount > 0 ? ` (${draftOrRejectedCount})` : ""}`}
            </button>
          </div>
        )}
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        {cloRejected ? <HodRejectionBanner title="CLOs" reason={cloRejectReason} /> : null}
        {canManage ? (
          <p className="mb-3 rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
            1) Add/save CLOs as <strong>Draft</strong> · 2) Click <strong>Upload</strong> to notify HOD · 3) After
            HOD approves, they appear on every other section of this subject as well.
            {pendingCount > 0 ? ` ${pendingCount} CLO(s) waiting for HOD.` : ""}
            {canManage && items.length > 0 && draftOrRejectedCount === 0 && pendingCount === 0
              ? " All current CLOs are already approved — add or edit one to create a new draft for Upload."
              : ""}
          </p>
        ) : (
          <p className="mb-3 rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
            View-only: HOD-approved CLOs for this subject are shared with every section of the same course.
            {isAllocatedTeacher
              ? " Your drafts from the allocated section also appear here until HOD approves."
              : " Drafts stay hidden until HOD approves."}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : (
          <div className="space-y-2.5 pb-16">
            {items.map((item) => {
              const isOld = isOldOutcome(item);
              const statusKey = isOld ? "approved" : getCloApprovalStatus(item);
              const approvalStatus = statusKey.charAt(0).toUpperCase() + statusKey.slice(1);
              const rowKey = isOld
                ? `old-${item.archiveId ?? item.ArchiveId}-${item.cloCode}`
                : item.cloId;
              return (
                <div
                  key={rowKey}
                  className={`flex items-start gap-3 rounded-lg border p-4 shadow-sm ${
                    isOld ? "border-amber-200 bg-amber-50/60" : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {canSeeDrafts || isOld ? (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isOld ? "bg-amber-200 text-amber-900" : approvalBadgeClass(approvalStatus)
                          }`}
                        >
                          {isOld ? "Old" : approvalStatus}
                        </span>
                      ) : null}
                      {item.cloCode ? (
                        <span className="inline-block rounded-full bg-lime-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                          {item.cloCode}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm font-medium leading-snug text-gray-900">{item.cloDescription}</p>
                    {canManage &&
                    String(approvalStatus).toLowerCase() === "rejected" &&
                    item.rejectionReason ? (
                      <p className="mt-2 text-xs text-red-700">Rejected: {item.rejectionReason}</p>
                    ) : null}
                  </div>
                  {canManage && !isOld && String(approvalStatus).toLowerCase() !== "pending" && (
                    <ListRowActions
                      onEdit={() => openEditForm(item)}
                      onDelete={() => handleDelete(item)}
                      editLabel="Edit CLO"
                      deleteLabel="Delete CLO"
                    />
                  )}
                </div>
              );
            })}
            {!items.length && (
              <p className="py-10 text-center text-sm text-gray-500">
                {canManage
                  ? "No CLOs yet. Add new ones or import from file, then Upload for HOD approval."
                  : "No approved CLOs for this subject yet."}
              </p>
            )}
          </div>
        )}
      </div>

      {actionModalVisible && canManage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-6"
          onClick={() => setActionModalVisible(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#0c181a] border border-transparent dark:border-white/10 p-5 sm:p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2 className="mb-4 text-center text-lg font-semibold text-gray-900 dark:text-white">CLOs</h2>
            <button
              type="button"
              onClick={() => {
                setActionModalVisible(false);
                setUploadModalVisible(true);
              }}
              className="mb-3 w-full min-h-[44px] rounded-lg py-3 font-black text-white transition hover:opacity-95"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              Import CLOs from file
            </button>
            <button
              type="button"
              onClick={openNewForm}
              className="w-full min-h-[44px] rounded-lg py-3 font-black text-white transition hover:opacity-95"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              Add New CLO
            </button>
            <button
              type="button"
              onClick={() => setActionModalVisible(false)}
              className="mt-4 w-full min-h-[44px] font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {formModalVisible && canManage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-6"
          onClick={() => setFormModalVisible(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg max-h-[calc(100dvh-1.5rem)] sm:max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#0c181a] border border-transparent dark:border-white/10 p-5 sm:p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              {editingItem ? "Edit CLO" : "New CLO"}
            </h2>
            <label className="text-sm font-extrabold text-gray-700 dark:text-gray-300">
              {editingItem ? "Edit CLO" : "Enter CLO"}
            </label>
            <textarea
              className="mt-2 min-h-[110px] w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-3 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#07858c]"
              placeholder="e.g. Apply fundamental physics principles to engineering problems."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button
              type="button"
              onClick={handleSave}
              className="mt-4 w-full min-h-[44px] rounded-lg py-3 font-black text-white transition hover:opacity-95"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setFormModalVisible(false)}
              className="mt-3 w-full min-h-[44px] font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {uploadModalVisible && canManage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-6"
          onClick={() => setUploadModalVisible(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#0c181a] border border-transparent dark:border-white/10 p-5 sm:p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Import CLOs file</h2>
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              Imported rows are saved as drafts. Use Upload to send them for HOD approval.
            </p>
            <label className="flex h-11 min-h-[44px] cursor-pointer items-center rounded-lg bg-gray-100 dark:bg-white/5 border border-transparent dark:border-white/10 px-3 font-bold text-gray-600 dark:text-gray-300">
              <input type="file" accept=".xlsx" className="hidden" onChange={pickFile} />
              {selectedFile ? selectedFile.name : "Browse"}
            </label>
            <button
              type="button"
              onClick={handleImport}
              disabled={uploading}
              className="mt-4 w-full min-h-[44px] rounded-lg py-3 font-black text-white disabled:opacity-60 transition hover:opacity-95"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              {uploading ? "…" : "Import"}
            </button>
            <button
              type="button"
              onClick={() => setUploadModalVisible(false)}
              className="mt-3 w-full min-h-[44px] font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
