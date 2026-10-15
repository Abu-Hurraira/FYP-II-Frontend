import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { deleteCourseFolderFile, downloadTeacherFile, getCourseFolderOverview, getFolderFiles, uploadFileToCourseFolder } from "../../api/teacherApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { HodRejectionBanner, useHodRejectionAlert } from "../../components/HodRejectionNotice.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";
import { folderDisplayName, getAuthUserId } from "../../utils/helpers";
import { isSubmitFolderLocked, resolveTeacherFolderStatus } from "../../utils/weeklyProgressHelpers";
import FcarGeneratorView from "../../components/FcarGeneratorView.jsx";
import theme from "../../styles/theme";

const EXAM_SAMPLE_TYPES = [
  { key: "mid", label: "Mid", category: "Mid Exam Samples Pack" },
  { key: "final", label: "Final", category: "Final Exam Samples Pack" },
];

function isSamplesFolder(folder) {
  const code = (folder?.templateCode ?? folder?.TemplateCode ?? "").toLowerCase();
  const name = folderDisplayName(folder).toLowerCase();
  return code === "i" || name.includes("sample");
}

/** @returns {"exams"|"assignment"|"quiz"|null} */
function resolveSamplesBucketKind(activeFolder) {
  const name = folderDisplayName(activeFolder).toLowerCase();
  if (name.includes("exam")) return "exams";
  if (name.includes("quiz")) return "quiz";
  if (name.includes("project") || name.includes("assign")) return "assignment";
  return null;
}

function samplesPackCategoryForBucket(kind) {
  if (kind === "assignment") return "Assignment Samples Pack";
  if (kind === "quiz") return "Quiz Samples Pack";
  return null;
}

export default function TeacherFolderUploadScreen() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
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
  const [childFolders, setChildFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState(folder || null);
  const [selectedByCategory, setSelectedByCategory] = useState({});
  const [uploadingCategory, setUploadingCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [examDialogOpen, setExamDialogOpen] = useState(false);
  const [examType, setExamType] = useState(null);
  const [examFile, setExamFile] = useState(null);
  const [samplesUploading, setSamplesUploading] = useState(false);
  const [bucketPickFile, setBucketPickFile] = useState(null);
  const samplesInputRef = useRef(null);
  const bucketInputRef = useRef(null);

  useEffect(() => {
    setActiveFolder(folder || null);
  }, [folder]);

  const loadFiles = useCallback(async () => {
    const directoryId = activeFolder?.directoryId ?? activeFolder?.DirectoryId;
    if (!directoryId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const result = await getFolderFiles(directoryId, offeredCourseId);
      if (Array.isArray(result)) {
        setFiles(result);
        setChildFolders([]);
      } else {
        setFiles(result?.files ?? result?.Files ?? []);
        setChildFolders(result?.folders ?? result?.Folders ?? []);
      }
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [activeFolder?.directoryId, activeFolder?.DirectoryId, offeredCourseId]);

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

  const openChildFolder = (child) => {
    setSelectedByCategory({});
    setBucketPickFile(null);
    setExamDialogOpen(false);
    setExamType(null);
    setExamFile(null);
    setActiveFolder(child);
  };

  const goToParentFolder = () => {
    if (!folder) return;
    setSelectedByCategory({});
    setBucketPickFile(null);
    setExamDialogOpen(false);
    setExamType(null);
    setExamFile(null);
    setActiveFolder(folder);
  };

  const isNestedBucket =
    Boolean(folder) &&
    Boolean(activeFolder) &&
    (activeFolder.directoryId ?? activeFolder.DirectoryId) !==
      (folder.directoryId ?? folder.DirectoryId);

  const samplesMode = isSamplesFolder(folder);
  const samplesRootDirectoryId = folder?.directoryId ?? folder?.DirectoryId;
  const samplesBucketKind = samplesMode && isNestedBucket ? resolveSamplesBucketKind(activeFolder) : null;

  const closeExamDialog = () => {
    setExamDialogOpen(false);
    setExamType(null);
    setExamFile(null);
  };

  const uploadSamplePack = async (category, file, label) => {
    if (!file) {
      showAlert("Select file", "Choose a PDF or document first.");
      return;
    }
    if (!teacherUserId || !samplesRootDirectoryId) {
      showAlert("Error", "Unable to upload. Missing user or folder.");
      return;
    }
    try {
      setSamplesUploading(true);
      const result = await uploadFileToCourseFolder(
        samplesRootDirectoryId,
        teacherUserId,
        category,
        file,
        offeredCourseId
      );
      showAlert("Uploaded", result?.message || `${label} sample uploaded.`);
      setBucketPickFile(null);
      closeExamDialog();
      await loadFiles();
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setSamplesUploading(false);
    }
  };

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
        activeFolder?.directoryId ?? activeFolder?.DirectoryId ?? folder.directoryId,
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

  const categories =
    activeFolder?.allowedFileCategories ??
    activeFolder?.AllowedFileCategories ??
    folder.allowedFileCategories ??
    folder.AllowedFileCategories ??
    [];

  const displayCategories = samplesMode
    ? categories.filter((c) => String(c).toLowerCase().includes("samples pack"))
    : categories;

  const samplesFiles = useMemo(() => {
    if (!samplesMode) return [];
    return files.filter((f) => {
      const cat = String(f.fileCategory ?? f.FileCategory ?? "").toLowerCase();
      return cat.includes("samples pack") || cat.includes("sample");
    });
  }, [samplesMode, files]);

  const renderFileRow = (file) => {
    const fileId = file.fileId ?? file.FileId;
    return (
      <div
        key={fileId}
        className="flex items-center rounded-xl border border-gray-100 bg-gray-50 p-3"
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <span className="truncate">{file.fileName ?? file.FileName}</span>
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">
              Uploaded
            </span>
          </p>
          {(file.fileCategory ?? file.FileCategory) ? (
            <p className="mt-0.5 text-xs text-gray-500">{file.fileCategory ?? file.FileCategory}</p>
          ) : null}
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() =>
              downloadTeacherFile(fileId, offeredCourseId, file.fileName ?? file.FileName).catch((err) =>
                showAlert("Download failed", err.message)
              )
            }
            className="text-sm font-extrabold text-brand"
          >
            Download
          </button>
          {!readOnly && !statusLoading && (
            <button
              type="button"
              onClick={() => deleteFile(fileId)}
              className="font-extrabold text-red-600"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderSamplesBucketBody = () => {
    const canUpload = !readOnly && !statusLoading;

    if (samplesBucketKind === "exams") {
      return (
        <div className="mt-6 space-y-3">
          {canUpload ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card shadow-sm">
              <p className="text-sm font-semibold text-gray-900">Upload exam sample</p>
              <p className="mt-0.5 text-xs text-gray-500">Choose Mid or Final, then upload a PDF or document.</p>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {EXAM_SAMPLE_TYPES.map((type) => (
                  <button
                    key={type.key}
                    type="button"
                    onClick={() => {
                      setExamType(type);
                      setExamFile(null);
                      setExamDialogOpen(true);
                    }}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-extrabold text-gray-900 hover:border-emerald-300 hover:bg-emerald-50"
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {samplesFiles.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No exam sample documents yet.</p>
          ) : (
            samplesFiles.map(renderFileRow)
          )}
        </div>
      );
    }

    if (samplesBucketKind === "assignment" || samplesBucketKind === "quiz") {
      const category = samplesPackCategoryForBucket(samplesBucketKind);
      const label = samplesBucketKind === "assignment" ? "Assignment" : "Quiz";
      return (
        <div className="mt-6 space-y-3">
          {canUpload ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card shadow-sm">
              <p className="text-sm font-semibold text-gray-900">Upload {label} sample</p>
              <label className="mt-3 block cursor-pointer rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-600">
                <input
                  ref={bucketInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    e.target.value = "";
                    setBucketPickFile(f);
                  }}
                />
                {bucketPickFile?.name || "Choose sample PDF or Docs"}
              </label>
              <button
                type="button"
                disabled={!bucketPickFile || samplesUploading || !category}
                onClick={() => uploadSamplePack(category, bucketPickFile, label)}
                className="mt-3 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
              >
                {samplesUploading ? "Uploading…" : "Upload sample PDF"}
              </button>
            </div>
          ) : null}
          {samplesFiles.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No {label.toLowerCase()} sample documents yet.</p>
          ) : (
            samplesFiles.map(renderFileRow)
          )}
        </div>
      );
    }

    return (
      <div className="mt-6 space-y-3">
        {samplesFiles.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">No sample documents here yet.</p>
        ) : (
          samplesFiles.map(renderFileRow)
        )}
      </div>
    );
  };

  return (
    <div className="relative min-h-full bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        {isNestedBucket ? (
          <button
            type="button"
            onClick={goToParentFolder}
            aria-label="Go back"
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold leading-none text-gray-600 transition hover:bg-brand-muted hover:text-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <span aria-hidden="true">←</span>
          </button>
        ) : (
          <PageBackButton className="mt-0.5" />
        )}
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h1 className="text-xl font-semibold text-gray-900">
            {folderDisplayName(activeFolder || folder)}
          </h1>
          {courseTitle && <p className="mt-0.5 text-xs text-gray-500">{courseTitle}</p>}
          {isNestedBucket ? (
            <p className="mt-0.5 text-xs text-gray-400">in {folderDisplayName(folder)}</p>
          ) : null}
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
        ) : samplesMode && childFolders.length > 0 && !isNestedBucket ? (
          <div className="mt-6 flex flex-col gap-2.5">
            {childFolders.map((child) => (
              <button
                key={child.directoryId ?? child.DirectoryId}
                type="button"
                onClick={() => openChildFolder(child)}
                className="flex w-full min-h-[48px] items-center rounded-2xl border border-gray-100 bg-white px-4 py-3 text-left shadow-card shadow-sm transition hover:bg-brand-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {folderDisplayName(child)}
                  </p>
                </div>
                <span className="shrink-0 text-xl text-gray-300">›</span>
              </button>
            ))}
          </div>
        ) : samplesMode ? (
          renderSamplesBucketBody()
        ) : childFolders.length > 0 ? (
          <div className="mt-6 flex flex-col gap-2.5">
            {childFolders.map((child) => (
              <button
                key={child.directoryId ?? child.DirectoryId}
                type="button"
                onClick={() => openChildFolder(child)}
                className="flex w-full min-h-[48px] items-center rounded-2xl border border-gray-100 bg-white px-4 py-3 text-left shadow-card shadow-sm transition hover:bg-brand-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {folderDisplayName(child)}
                  </p>
                </div>
                <span className="shrink-0 text-xl text-gray-300">›</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-8">
            {(displayCategories.length > 0 ? displayCategories : ["Other"]).map((category) => {
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
                    {categoryFiles.map(renderFileRow)}
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

      {examDialogOpen && examType ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
          <div className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#0c181a] border border-transparent dark:border-white/10 p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">{examType.label} sample</h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Upload a PDF or Word file.</p>
              </div>
              <button
                type="button"
                onClick={closeExamDialog}
                className="text-sm font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 p-1"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block cursor-pointer rounded-xl border border-dashed border-gray-300 dark:border-white/15 bg-gray-50 dark:bg-white/5 p-4 text-center text-sm text-gray-600 dark:text-gray-300">
                <input
                  ref={samplesInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    e.target.value = "";
                    setExamFile(f);
                  }}
                />
                {examFile?.name || "Choose PDF or Docs file"}
              </label>
              <button
                type="button"
                disabled={!examFile || samplesUploading}
                onClick={() => uploadSamplePack(examType.category, examFile, examType.label)}
                className="w-full min-h-[44px] rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50 transition hover:opacity-95"
              >
                {samplesUploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
