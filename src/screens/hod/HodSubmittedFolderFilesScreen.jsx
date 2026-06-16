import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { getFolderFiles } from "../../api/teacherApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import theme from "../../styles/theme";
import { showAlert } from "../../utils/dialogs";
import { stripFolderTemplatePrefix } from "../../utils/helpers";

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

  const loadFiles = useCallback(async () => {
    const id = folder?.directoryId ?? Number(directoryId);
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      const result = await getFolderFiles(id);
      setFiles(Array.isArray(result) ? result : []);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [folder?.directoryId, directoryId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const folderName = stripFolderTemplatePrefix(folder?.directoryName) || "Folder section";

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
          <div className="space-y-2.5">
            {files.map((file) => {
              const uploadedAt = formatDate(file.uploadedAt ?? file.UploadedAt);
              return (
                <div
                  key={file.fileId ?? file.FileId}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-sm font-semibold text-gray-900">{file.fileName ?? file.FileName}</p>
                  <p className="mt-1 text-sm text-gray-600">{file.fileCategory ?? file.FileCategory ?? "—"}</p>
                  {file.remarks ?? file.Remarks ? (
                    <p className="mt-1 text-xs text-gray-500">{file.remarks ?? file.Remarks}</p>
                  ) : null}
                  {uploadedAt ? (
                    <p className="mt-1 text-xs text-gray-400">Uploaded: {uploadedAt}</p>
                  ) : null}
                  {file.filePath ?? file.FilePath ? (
                    <p className="mt-1 break-all text-xs text-gray-400">{file.filePath ?? file.FilePath}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
