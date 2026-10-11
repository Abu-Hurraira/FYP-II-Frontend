import React, { useCallback, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  createMasterFolder,
  createCustomFolder,
  getCourseFolderOverview,
  importMainFolderDataToSubmittedFolder,
  submitCourseFolder,
  validateCourseFolder,
} from "../../api/teacherApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { HodRejectionBanner, useHodRejectionAlert } from "../../components/HodRejectionNotice.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";
import theme from "../../styles/theme";
import { folderDisplayName } from "../../utils/helpers";
import { isSubmitFolderLocked, resolveTeacherFolderStatus } from "../../utils/weeklyProgressHelpers";

export default function TeacherCourseFolderScreen() {
  const { user } = useContext(AuthContext);
  const { offeredCourseId: oc } = useParams();
  const offeredCourseId = Number(oc);
  const [searchParams] = useSearchParams();
  const routeT = searchParams.get("teacherUserId");
  const teacherUserId =
    routeT != null && routeT !== "" ? Number(routeT) || user?.userId : user?.userId;

  const navigate = useNavigate();
  const location = useLocation();
  const knownStatus = location.state?.folderStatus ?? null;
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [customName, setCustomName] = useState("");
  const [creatingCustom, setCreatingCustom] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const result = await getCourseFolderOverview(offeredCourseId);
      setOverview(result);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [offeredCourseId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleCreate = async () => {
    try {
      setLoading(true);
      const result = await createMasterFolder(offeredCourseId, teacherUserId);
      setOverview(result);
      showAlert("Success", "MasterFolder and all required folders created.");
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const validation = await validateCourseFolder(offeredCourseId);

      if (!validation.canSubmit) {
        showAlert("Missing files", validation.missingFiles.join("\n\n"));
        return;
      }

      if (
        !(await showConfirm(
          "Submit Folder",
          "Are you sure? After submission, this section's folders will be locked until HOD review."
        ))
      ) {
        return;
      }

      try {
        const result = await submitCourseFolder(offeredCourseId, teacherUserId);
        showAlert("Submitted", result.message);
        loadOverview();
      } catch (error) {
        showAlert("Missing files", error.message);
      }
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const handleCreateCustom = async () => {
    const name = customName.trim();
    if (!name) {
      showAlert("Validation Error", "Enter a folder name.");
      return;
    }
    try {
      setCreatingCustom(true);
      const result = await createCustomFolder(offeredCourseId, teacherUserId, name);
      setOverview(result);
      setCustomName("");
      showAlert("Created", `Folder "${name}" added.`);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setCreatingCustom(false);
    }
  };

  const handleImportMainData = async () => {
    if (
      !(await showConfirm(
        "Import main-folder data",
        "Copy all saved main-folder data into these submitted folders as PDFs? You can download each file afterwards."
      ))
    ) {
      return;
    }
    try {
      setPublishing(true);
      const result = await importMainFolderDataToSubmittedFolder(offeredCourseId, teacherUserId);
      const count = result?.importedCount ?? result?.ImportedCount ?? 0;
      showAlert(
        "Imported",
        result?.message ||
          `Saved main-folder data was copied into the submitted folders as PDFs (${count} item(s)).`
      );
      await loadOverview();
    } catch (error) {
      showAlert("Import failed", error.message);
    } finally {
      setPublishing(false);
    }
  };

  const folderStatus = resolveTeacherFolderStatus(overview, knownStatus);
  const courseReadOnly = isSubmitFolderLocked(folderStatus);
  const showSubmit = Boolean(overview?.isCreated && !courseReadOnly);
  const rejectionReason = overview?.rejectionReason ?? overview?.RejectionReason ?? "";
  useHodRejectionAlert(
    Boolean(overview) && String(folderStatus).toLowerCase() === "rejected",
    "course folder",
    rejectionReason
  );

  if (loading && !overview) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
          style={{ borderTopColor: theme.colors.primary }}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-full bg-page">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-gray-900">{overview?.courseTitle || "Folder"}</h1>
          <p className="mt-0.5 text-xs text-gray-500">{user?.fullName || user?.name || "Teacher"}</p>
        </div>
        {showSubmit ? (
          <button
            type="button"
            onClick={handleSubmit}
            className="shrink-0 rounded-lg bg-indigo-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-900"
          >
            Submit
          </button>
        ) : null}
      </div>

      {!overview?.isCreated ? (
        <div className="mx-4 mt-6 rounded-2xl border border-gray-100 bg-white shadow-card p-6 text-center shadow-sm sm:mx-6 lg:mx-8">
          <p className="text-gray-600">MasterFolder has not been created yet.</p>
          <button
            type="button"
            onClick={handleCreate}
            className="app-btn-primary mt-5 rounded-2xl px-6 py-3 font-extrabold"
          >
            Create MasterFolder
          </button>
        </div>
      ) : (
        <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
          {folderStatus === "Submitted" && (
            <div className="mb-4 rounded-xl bg-blue-100 p-4 text-center">
              <p className="font-extrabold text-blue-900">Submitted — awaiting HOD review</p>
              <p className="mt-1 text-sm text-blue-800">All folders are locked. You can view files only.</p>
            </div>
          )}

          {folderStatus === "Approved" && (
            <div className="mb-4 rounded-xl bg-emerald-100 p-4 text-center">
              <p className="font-extrabold text-emerald-800">Approved by HOD</p>
              <p className="mt-1 text-sm text-emerald-900">All folders are locked. You can view files only.</p>
            </div>
          )}

          {folderStatus === "Rejected" && (
            <HodRejectionBanner title="course folder" reason={rejectionReason} />
          )}

          {!courseReadOnly ? (
            <div className="mb-4 space-y-3">
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold"
                  placeholder="Custom folder name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
                <button
                  type="button"
                  disabled={creatingCustom}
                  onClick={handleCreateCustom}
                  className="rounded-xl bg-[#15803d] px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50"
                >
                  {creatingCustom ? "Adding…" : "Add folder"}
                </button>
              </div>
              <button
                type="button"
                disabled={publishing}
                onClick={handleImportMainData}
                className="w-full rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-extrabold text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
              >
                {publishing ? "Importing…" : "Import saved main-folder data as PDFs"}
              </button>
            </div>
          ) : null}

          {(overview.folders ?? overview.Folders ?? []).map((folder) => {
            const folderLocked = courseReadOnly;

            return (
              <button
                key={folder.directoryId}
                type="button"
                onClick={() =>
                  navigate("/teacher/folder-upload", {
                    state: {
                      folder,
                      teacherUserId,
                      offeredCourseId,
                      isLocked: folderLocked,
                      courseTitle: overview.courseTitle,
                      folderSubmissionStatus: folderStatus,
                      rejectionReason,
                    },
                  })
                }
                className={`mb-2.5 flex w-full min-h-[48px] items-center rounded-2xl border px-4 py-3 text-left shadow-card shadow-sm transition ${
                  folderStatus === "Approved"
                    ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100/70"
                    : "border-gray-100 bg-white hover:bg-brand-muted/40"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {folderDisplayName(folder)}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {folder.fileCount} file(s)
                    {folderLocked ? " · Locked" : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xl text-gray-300">›</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
