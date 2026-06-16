import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCourseFolderOverview } from "../../api/teacherApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import theme from "../../styles/theme";
import { showAlert } from "../../utils/dialogs";
import { formatSubmittedFolderLabel, stripFolderTemplatePrefix } from "../../utils/helpers";

export default function HodSubmittedFolderDetailScreen() {
  const { user } = useContext(AuthContext);
  const { offeredCourseId: oc } = useParams();
  const offeredCourseId = Number(oc);
  const navigate = useNavigate();

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
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

  if (!overview?.isCreated) {
    return (
      <div className="min-h-full bg-page">
        <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
          <PageBackButton className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-gray-900">Submitted Folder</h1>
          </div>
        </div>
        <p className="py-16 text-center text-sm text-gray-500">Folder not found or not created yet.</p>
      </div>
    );
  }

  if (!overview.isLocked) {
    return (
      <div className="min-h-full bg-page">
        <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
          <PageBackButton className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-gray-900">{overview.courseTitle || "Folder"}</h1>
          </div>
        </div>
        <p className="py-16 text-center text-sm text-gray-500">
          This folder has not been submitted yet. Only completed submissions are shown here.
        </p>
      </div>
    );
  }

  const folderLabel = formatSubmittedFolderLabel(overview);

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-gray-900">{overview.courseTitle || "Folder"}</h1>
          <p className="mt-0.5 text-xs text-gray-500">{user?.roleName || "HOD"} · Read only</p>
        </div>
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        <div className="mb-4 rounded-xl bg-emerald-100 p-4 text-center">
          <p className="font-extrabold text-emerald-800">Submitted folder — view only</p>
          {folderLabel ? <p className="mt-1 text-sm text-emerald-900">{folderLabel}</p> : null}
        </div>

        <div className="space-y-2.5">
          {(overview.folders || []).map((folder) => (
            <button
              key={folder.directoryId}
              type="button"
              onClick={() =>
                navigate(`/hod/submitted-folders/${offeredCourseId}/folder/${folder.directoryId}`, {
                  state: {
                    folder,
                    courseTitle: overview.courseTitle,
                  },
                })
              }
              className="flex w-full min-h-[48px] items-center rounded-lg border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-gray-50"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  {stripFolderTemplatePrefix(folder.directoryName)}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">{folder.fileCount ?? 0} file(s)</p>
              </div>
              <span className="shrink-0 text-xl text-gray-300">›</span>
            </button>
          ))}
        </div>

        {(overview.folders || []).length === 0 && (
          <p className="py-10 text-center text-sm text-gray-500">No folder sections found.</p>
        )}
      </div>
    </div>
  );
}
