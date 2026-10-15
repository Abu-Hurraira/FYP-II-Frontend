import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { getHodSubmittedFolderFiles } from "../../api/hodFolderReviewApi";
import { downloadTeacherFile } from "../../api/teacherApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import theme from "../../styles/theme";
import { showAlert } from "../../utils/dialogs";
import { folderDisplayName } from "../../utils/helpers";

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

export default function HodSubmittedFolderFilesScreen() {
  const { offeredCourseId, directoryId } = useParams();
  const location = useLocation();
  const folder = location.state?.folder;
  const courseTitle = location.state?.courseTitle;

  const [activeFolder, setActiveFolder] = useState(folder || null);
  const [childFolders, setChildFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    setActiveFolder(folder || { directoryId: Number(directoryId) });
  }, [folder, directoryId]);

  const loadFiles = useCallback(async () => {
    const id = activeFolder?.directoryId ?? activeFolder?.DirectoryId ?? Number(directoryId);
    if (!id || !offeredCourseId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await getHodSubmittedFolderFiles(offeredCourseId, id);
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
  }, [activeFolder?.directoryId, activeFolder?.DirectoryId, directoryId, offeredCourseId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleDownload = async (file) => {
    const fileId = file.fileId ?? file.FileId;
    if (!fileId) {
      showAlert("Download", "This file cannot be downloaded.");
      return;
    }
    try {
      setDownloadingId(fileId);
      await downloadTeacherFile(
        fileId,
        Number(offeredCourseId),
        file.fileName ?? file.FileName
      );
    } catch (error) {
      showAlert("Download failed", error.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const filesByCategory = useMemo(() => {
    const grouped = {};
    for (const file of files) {
      const category = file.fileCategory ?? file.FileCategory ?? "Other";
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(file);
    }
    return Object.entries(grouped);
  }, [files]);

  const rootFolder = folder || { directoryId: Number(directoryId) };
  const isNested =
    Boolean(activeFolder) &&
    (activeFolder.directoryId ?? activeFolder.DirectoryId) !==
      (rootFolder.directoryId ?? rootFolder.DirectoryId);
  const folderName = folderDisplayName(activeFolder || rootFolder) || "Folder section";

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        {isNested ? (
          <button
            type="button"
            onClick={() => setActiveFolder(rootFolder)}
            className="mt-0.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            ← Back
          </button>
        ) : (
          <PageBackButton className="mt-0.5" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-gray-900">{folderName}</h1>
          {courseTitle ? <p className="mt-0.5 text-xs text-gray-500">{courseTitle} · Read only</p> : null}
        </div>
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        <p className="mb-4 rounded-lg bg-gray-100 px-3 py-2 text-center text-xs font-semibold text-gray-600">
          All files submitted by the teacher in this section
        </p>

        {loading ? (
          <div className="flex justify-center py-16">
            <div
              className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : childFolders.length > 0 ? (
          <div className="space-y-2.5">
            {childFolders.map((child) => {
              const count = child.fileCount ?? child.FileCount ?? 0;
              return (
                <button
                  key={child.directoryId ?? child.DirectoryId}
                  type="button"
                  onClick={() => setActiveFolder(child)}
                  className="flex w-full min-h-[48px] items-center rounded-2xl border border-gray-100 bg-white px-4 py-3 text-left shadow-card shadow-sm transition hover:bg-brand-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{folderDisplayName(child)}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{count} file(s)</p>
                  </div>
                  <span className="shrink-0 text-xl text-gray-300">›</span>
                </button>
              );
            })}
          </div>
        ) : files.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">No files in this section.</p>
        ) : (
          <div className="space-y-6">
            {filesByCategory.map(([category, categoryFiles]) => (
              <section key={category} className="space-y-2.5">
                <h2 className="text-sm font-extrabold text-gray-900">{category}</h2>
                {categoryFiles.map((file) => {
                  const fileId = file.fileId ?? file.FileId;
                  const uploadedAt = formatDate(file.uploadedAt ?? file.UploadedAt);
                  const busy = downloadingId === fileId;
                  return (
                    <div
                      key={fileId}
                      className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white shadow-card p-4 shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900">{file.fileName ?? file.FileName}</p>
                        {file.remarks ?? file.Remarks ? (
                          <p className="mt-1 text-xs text-gray-500">{file.remarks ?? file.Remarks}</p>
                        ) : null}
                        {uploadedAt ? (
                          <p className="mt-1 text-xs text-gray-400">Uploaded: {uploadedAt}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDownload(file)}
                        className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-brand-muted/40 disabled:opacity-60"
                      >
                        {busy ? "Downloading…" : "Download"}
                      </button>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
