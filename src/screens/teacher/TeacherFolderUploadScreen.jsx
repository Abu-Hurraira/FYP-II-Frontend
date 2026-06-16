import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { deleteCourseFolderFile, getFolderFiles, uploadFileToCourseFolder } from "../../api/teacherApi";
import { getHodUploadAllocation } from "../../api/hodUploadAllocationApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";
import { stripFolderTemplatePrefix } from "../../utils/helpers";
import { filterCategoriesByAllocation } from "../../utils/uploadAllocationHelpers";
import theme from "../../styles/theme";

export default function TeacherFolderUploadScreen() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const { folder, teacherUserId: stateT, isLocked, courseTitle, folderSubmissionStatus, rejectionReason, offeredCourseId } =
    location.state || {};

  const teacherUserId = stateT != null ? stateT : user?.userId;

  const [files, setFiles] = useState([]);
  const [allocation, setAllocation] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);

  const allowedCategories = useMemo(() => {
    if (!folder?.allowedFileCategories) return [];
    if (!offeredCourseId || !allocation) return folder.allowedFileCategories;
    return filterCategoriesByAllocation(folder.allowedFileCategories, offeredCourseId, allocation);
  }, [folder, offeredCourseId, allocation]);

  useEffect(() => {
    if (!allowedCategories.length) return;
    if (!allowedCategories.includes(selectedCategory)) {
      setSelectedCategory(allowedCategories[0]);
    }
  }, [allowedCategories, selectedCategory]);

  useEffect(() => {
    (async () => {
      try {
        const config = await getHodUploadAllocation();
        setAllocation(config);
      } catch {
        setAllocation({ configured: false, allocations: {} });
      }
    })();
  }, []);

  const loadFiles = useCallback(async () => {
    if (!folder?.directoryId) {
      setLoading(false);
      return;
    }
    try {
      const result = await getFolderFiles(folder.directoryId);
      setFiles(result);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [folder?.directoryId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      const category = file.fileCategory ?? file.FileCategory ?? "";
      return category === selectedCategory;
    });
  }, [files, selectedCategory]);

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

  const pickFile = (e) => {
    if (isLocked) {
      showAlert("Locked", "Submitted folders cannot be changed.");
      return;
    }
    const f = e.target.files?.[0];
    if (f) setSelectedFile(f);
  };

  const upload = async () => {
    if (isLocked) {
      showAlert("Locked", "Submitted folders cannot be changed.");
      return;
    }
    if (!selectedFile) {
      showAlert("Select file", "Please select a file first.");
      return;
    }
    try {
      const result = await uploadFileToCourseFolder(
        folder.directoryId,
        teacherUserId,
        selectedCategory,
        selectedFile
      );
      showAlert("Uploaded", result.message);
      setSelectedFile(null);
      loadFiles();
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const deleteFile = async (fileId) => {
    if (isLocked) {
      showAlert("Locked", "Submitted folders cannot be changed.");
      return;
    }
    if (!(await showConfirm("Delete File", "Are you sure?"))) return;
    try {
      await deleteCourseFolderFile(fileId);
      loadFiles();
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  return (
    <div className="relative min-h-full bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton className="mt-0.5" />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h1 className="text-xl font-semibold text-gray-900">
            {stripFolderTemplatePrefix(folder.directoryName)}
          </h1>
          {courseTitle && <p className="mt-0.5 text-xs text-gray-500">{courseTitle}</p>}
        </div>
      </div>

      <div className="px-4 pb-28 pt-3 sm:px-6 lg:px-8">
      {folderSubmissionStatus === "Submitted" && isLocked && (
        <p className="mt-3 text-center font-extrabold text-blue-800">Submitted — awaiting HOD review (view only)</p>
      )}
      {folderSubmissionStatus === "Approved" && isLocked && (
        <p className="mt-3 text-center font-extrabold text-emerald-700">Approved by HOD (view only)</p>
      )}
      {folderSubmissionStatus === "Rejected" && rejectionReason && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-800">
          HOD feedback: {rejectionReason}
        </p>
      )}
      {isLocked && !folderSubmissionStatus && (
        <p className="mt-3 text-center font-extrabold text-emerald-700">Submitted folder is locked.</p>
      )}

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p className="mb-2 font-extrabold text-gray-900">File Category</p>
        {allowedCategories.length === 0 ? (
          <p className="text-sm text-gray-500">No upload categories allocated for you in this folder.</p>
        ) : (
        <div className="flex flex-wrap gap-2">
          {allowedCategories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => {
                setSelectedCategory(category);
                setSelectedFile(null);
              }}
              className={`rounded-full px-4 py-2 text-sm ${
                selectedCategory === category
                  ? "bg-brand font-extrabold text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        )}
      </div>

      {!isLocked && allowedCategories.length > 0 && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <label className="block cursor-pointer rounded-lg bg-gray-100 p-3 text-gray-600">
            <input type="file" className="hidden" onChange={pickFile} />
            {selectedFile?.name || "Choose file"}
          </label>
          <button
            type="button"
            onClick={upload}
            className="mt-3 w-full rounded-lg bg-brand py-3 font-extrabold text-white"
          >
            Upload File
          </button>
        </div>
      )}

      <h2 className="mt-6 text-sm font-semibold text-gray-900">
        Uploaded files — {selectedCategory}
      </h2>

      {loading ? (
        <div className="flex justify-center py-10">
          <div
            className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
            style={{ borderTopColor: theme.colors.primary }}
          />
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {filteredFiles.map((file) => (
            <div key={file.fileId ?? file.FileId} className="flex items-center rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{file.fileName ?? file.FileName}</p>
                <p className="text-sm text-gray-500">{file.fileCategory ?? file.FileCategory}</p>
              </div>
              {!isLocked && (
                <button
                  type="button"
                  onClick={() => deleteFile(file.fileId ?? file.FileId)}
                  className="font-extrabold text-red-600"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
          {filteredFiles.length === 0 && (
            <p className="py-8 text-center text-gray-500">
              No files uploaded for {selectedCategory} yet.
            </p>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
