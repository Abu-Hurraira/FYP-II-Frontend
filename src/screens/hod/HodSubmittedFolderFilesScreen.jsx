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

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);

  const loadFiles = useCallback(async () => {
    const id = folder?.directoryId ?? folder?.DirectoryId ?? Number(directoryId);
    if (!id || !offeredCourseId) {
      setLoading(false);
      return;
    }

    try {
      const result = await getHodSubmittedFolderFiles(offeredCourseId, id);
      setFiles(Array.isArray(result) ? result : []);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [folder?.directoryId, folder?.DirectoryId, directoryId, offeredCourseId]);

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

  const folderName = folderDisplayName(folder) || "Folder section";

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton className="mt-0.5" />
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
