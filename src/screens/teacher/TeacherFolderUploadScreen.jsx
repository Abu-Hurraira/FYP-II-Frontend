import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { deleteCourseFolderFile, downloadTeacherFile, getCourseFolderOverview, getFolderFiles, uploadFileToCourseFolder } from "../../api/teacherApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { HodRejectionBanner, useHodRejectionAlert } from "../../components/HodRejectionNotice.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";
import { folderDisplayName, getAuthUserId } from "../../utils/helpers";
import { isSubmitFolderLocked, resolveTeacherFolderStatus } from "../../utils/weeklyProgressHelpers";
import FcarGeneratorView from "../../components/FcarGeneratorView.jsx";
import theme from "../../styles/theme";


export default function TeacherFolderUploadScreen() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const {
    folder,
    teacherUserId: stateT,
    offeredCourseId,
    isLocked,
    courseTitle,
    folderSubmissionStatus,
    rejectionReason,
  } = location.state || {};

  const teacherUserId = stateT != null ? stateT : getAuthUserId(user);
  const [courseStatus, setCourseStatus] = useState(folderSubmissionStatus ?? null);
  const [statusLoading, setStatusLoading] = useState(Boolean(offeredCourseId));
  const [liveRejectionReason, setLiveRejectionReason] = useState(rejectionReason || "");

  useEffect(() => {
    if (!offeredCourseId) {
      setStatusLoading(false);
      return;
    }
    let cancelled = false;
    getCourseFolderOverview(offeredCourseId)
      .then((overview) => {
        if (!cancelled) {
          setCourseStatus(resolveTeacherFolderStatus(overview, folderSubmissionStatus));
          const reason = overview?.rejectionReason ?? overview?.RejectionReason ?? "";
          if (reason) setLiveRejectionReason(reason);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [offeredCourseId, folderSubmissionStatus]);

  const statusLabel = resolveTeacherFolderStatus(courseStatus, folderSubmissionStatus);
  const readOnly = isSubmitFolderLocked(statusLabel) || Boolean(isLocked);
  useHodRejectionAlert(
    String(statusLabel).toLowerCase() === "rejected",
    "course folder",
    liveRejectionReason,
    !statusLoading
  );

  const [files, setFiles] = useState([]);
  const [selectedByCategory, setSelectedByCategory] = useState({});
  const [uploadingCategory, setUploadingCategory] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadFiles = useCallback(async () => {
    if (!folder?.directoryId) {
      setLoading(false);
      return;
    }
    try {
      const result = await getFolderFiles(folder.directoryId, offeredCourseId);
      setFiles(Array.isArray(result) ? result : []);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [folder?.directoryId, offeredCourseId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const filesByCategory = useMemo(() => {
    const grouped = {};
    for (const file of files) {
      const category = file.fileCategory ?? file.FileCategory ?? "Other";
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(file);
    }
    return grouped;
  }, [files]);

  if (!folder) {
    return (
      <div className="min-h-full bg-page">
        <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
          <PageBackButton className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-gray-900">Folder upload</h1>
            <p className="mt-0.5 text-xs text-gray-500">No folder selected. Open this screen from a course folder.</p>
          </div>
        </div>
      </div>
    );
  }

  const pickFile = (category, e) => {
    if (readOnly) {
      showAlert("Locked", "This folder is locked and cannot be changed.");
      return;
    }
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setSelectedByCategory((prev) => ({ ...prev, [category]: f }));
  };

  const upload = async (category) => {
    if (readOnly) {
      showAlert("Locked", "This folder is locked and cannot be changed.");
      return;
    }
    const selectedFile = selectedByCategory[category];
    if (!selectedFile) {
      showAlert("Select file", "Please select a file first.");
      return;
    }
    if (!teacherUserId) {
      showAlert("Error", "Unable to upload. Missing user. Try logging in again.");
      return;
    }
    try {
      setUploadingCategory(category);
      const result = await uploadFileToCourseFolder(
        folder.directoryId,
        teacherUserId,
        category,
        selectedFile,
        offeredCourseId
      );
      showAlert("Uploaded", result.message);
      setSelectedByCategory((prev) => ({ ...prev, [category]: null }));
      loadFiles();
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setUploadingCategory(null);
    }
  };

  const deleteFile = async (fileId) => {
    if (readOnly) {
      showAlert("Locked", "This folder is locked and cannot be changed.");
      return;
    }
    if (!(await showConfirm("Delete File", "Are you sure?"))) return;
    try {
      await deleteCourseFolderFile(fileId, offeredCourseId);
      loadFiles();
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const categories = folder.allowedFileCategories ?? folder.AllowedFileCategories ?? [];

  return (
    <div className="relative min-h-full bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton className="mt-0.5" />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h1 className="text-xl font-semibold text-gray-900">
            {folderDisplayName(folder)}
          </h1>
          {courseTitle && <p className="mt-0.5 text-xs text-gray-500">{courseTitle}</p>}
        </div>
      </div>

      <div className="px-4 pb-28 pt-3 sm:px-6 lg:px-8">
        {statusLabel === "Submitted" && readOnly && (
          <p className="mt-3 text-center font-extrabold text-blue-800">
            Folder locked — course submission awaiting HOD review (view only)
          </p>
        )}
        {statusLabel === "Approved" && readOnly && (
          <p className="mt-3 text-center font-extrabold text-emerald-700">
            Folder locked — course submission approved by HOD (view only)
          </p>
        )}
        {statusLabel === "Rejected" ? (
          <HodRejectionBanner title="course folder" reason={liveRejectionReason} />
        ) : null}
        {readOnly && !statusLabel && (
          <p className="mt-3 text-center font-extrabold text-emerald-700">This folder is locked.</p>
        )}

        {((folder?.templateCode ?? folder?.TemplateCode ?? "").toLowerCase() === "o"
          || folderDisplayName(folder).toLowerCase().includes("fcar")) && (
          <div className="mt-4 mb-6">
            <FcarGeneratorView
              offeredCourseId={offeredCourseId}
              teacherUserId={teacherUserId}
            />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <div
              className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-8">
            {(categories.length > 0 ? categories : ["Other"]).map((category) => {
              const categoryFiles = filesByCategory[category] ?? [];
              const selectedFile = selectedByCategory[category];
              return (
                <section key={category} className="rounded-2xl border border-gray-100 bg-white shadow-card p-4 shadow-sm">
                  <h2 className="text-base font-extrabold text-gray-900">{category}</h2>

                  {!readOnly && !statusLoading && (
                    <div className="mt-3">
                      <label className="block cursor-pointer rounded-lg bg-gray-100 p-3 text-gray-600">
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => pickFile(category, e)}
                        />
                        {selectedFile?.name || "Choose any file to upload"}
                      </label>
                      <button
                        type="button"
                        onClick={() => upload(category)}
                        disabled={uploadingCategory === category}
                        className="mt-3 w-full app-btn-primary app-btn-primary-block rounded-2xl py-3 font-extrabold disabled:opacity-60"
                      >
                        {uploadingCategory === category ? "Uploading…" : "Upload File"}
                      </button>
                    </div>
                  )}

                  <div className="mt-4 flex flex-col gap-3">
                    {categoryFiles.map((file) => (
                      <div
                        key={file.fileId ?? file.FileId}
                        className="flex items-center rounded-xl border border-gray-100 bg-gray-50 p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {file.fileName ?? file.FileName}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <button
                            type="button"
                            onClick={() =>
                              downloadTeacherFile(
                                file.fileId ?? file.FileId,
                                offeredCourseId,
                                file.fileName ?? file.FileName
                              ).catch((err) => showAlert("Download failed", err.message))
                            }
                            className="text-sm font-extrabold text-brand"
                          >
                            Download
                          </button>
                          {!readOnly && !statusLoading && (
                            <button
                              type="button"
                              onClick={() => deleteFile(file.fileId ?? file.FileId)}
                              className="font-extrabold text-red-600"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {categoryFiles.length === 0 && (
                      <p className="py-4 text-center text-sm text-gray-500">
                        No files uploaded for {category} yet.
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
