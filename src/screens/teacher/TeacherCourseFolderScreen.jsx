import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  createMasterFolder,
  getCourseFolderOverview,
  submitCourseFolder,
  validateCourseFolder,
} from "../../api/teacherApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";
import theme from "../../styles/theme";

export default function TeacherCourseFolderScreen() {
  const { user } = useContext(AuthContext);
  const { offeredCourseId: oc } = useParams();
  const offeredCourseId = Number(oc);
  const [searchParams] = useSearchParams();
  const routeT = searchParams.get("teacherUserId");
  const teacherUserId =
    routeT != null && routeT !== "" ? Number(routeT) || user?.userId : user?.userId;

  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

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
          "Are you sure? After submission, this folder will be locked."
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

  const showSubmit = overview?.isCreated && !overview?.isLocked;

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
        <div className="mx-4 mt-6 rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm sm:mx-6 lg:mx-8">
          <p className="text-gray-600">MasterFolder has not been created yet.</p>
          <button
            type="button"
            onClick={handleCreate}
            className="mt-5 rounded-lg bg-brand px-6 py-3 font-extrabold text-white"
          >
            Create MasterFolder
          </button>
        </div>
      ) : (
        <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
          {overview.isLocked && (
            <div className="mb-4 rounded-xl bg-emerald-100 p-4 text-center">
              <p className="font-extrabold text-emerald-800">This folder is submitted and locked.</p>
            </div>
          )}

          {overview.folders.map((folder) => (
            <button
              key={folder.directoryId}
              type="button"
              disabled={overview.isLocked}
              onClick={() =>
                navigate("/teacher/folder-upload", {
                  state: {
                    folder,
                    teacherUserId,
                    isLocked: overview.isLocked,
                    courseTitle: overview.courseTitle,
                  },
                })
              }
              className="mb-2.5 flex w-full min-h-[48px] items-center rounded-lg border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{folder.directoryName}</p>
                <p className="mt-0.5 text-xs text-gray-500">{folder.fileCount} file(s)</p>
              </div>
              <span className="shrink-0 text-xl text-gray-300">›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
