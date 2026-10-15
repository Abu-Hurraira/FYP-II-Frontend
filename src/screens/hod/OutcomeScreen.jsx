import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import theme from "../../styles/theme";
import PageBackButton from "../../components/PageBackButton.jsx";
import HodMintHeader from "../../components/HodMintHeader.jsx";
import AddHeaderButton from "../../components/AddHeaderButton.jsx";
import ListRowActions from "../../components/ListRowActions.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";
import { sortPeos, sortPlos } from "../../utils/outcomeHelpers";
import {
  formatRestoreSummary,
  getArchiveId,
  isOldOutcome,
} from "../../utils/outcomeArchivedView";
import { listOutcomeCatalogVersions, applyOutcomeCatalog } from "../../api/outcomeCatalogApi";

const PLO_MAX_COUNT = 12;

/** Backend requires a code; assign PLO1–PLO12 / PEO1… for new outcomes. */
function getNextOutcomeCode(existingItems, outcomeType) {
  const isPlo = outcomeType === "PLO";
  const codeField = isPlo ? "ploCode" : "peoCode";
  const prefix = isPlo ? "PLO" : "PEO";
  const max = isPlo ? PLO_MAX_COUNT : 99;

  if (isPlo && existingItems.length >= max) return null;

  const used = new Set();
  for (const item of existingItems) {
    const match = String(item[codeField] || "").match(/(\d+)/);
    if (match) used.add(Number(match[1]));
  }

  for (let i = 1; i <= max; i++) {
    if (!used.has(i)) return `${prefix}${i}`;
  }
  return null;
}

const OutcomeScreen = ({
  type,
  getItems,
  createItem,
  updateItem,
  deleteItem,
  importItems,
  restoreAllByProgram,
  programsPath = "/hod/programs",
}) => {
  const { programId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const program = location.state?.program;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);

  const [editingItem, setEditingItem] = useState(null);
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [catalogModalVisible, setCatalogModalVisible] = useState(false);
  const [catalogVersions, setCatalogVersions] = useState([]);
  const [selectedCatalogVersionId, setSelectedCatalogVersionId] = useState("");
  const [restoringCatalog, setRestoringCatalog] = useState(false);

  const isPLO = type === "PLO";
  const targetProgramId = Number(programId || program?.programId);
  const valid = Boolean(targetProgramId && !isNaN(targetProgramId));

  const loadItems = async ({ includeArchived = false } = {}) => {
    if (!valid) return;
    try {
      setLoading(true);
      const data = await getItems(targetProgramId, { includeArchived });
      const list = data || [];
      setItems(isPLO ? sortPlos(list) : sortPeos(list));
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const activeItems = items.filter(
    (item) => String(item.outcomeStatus ?? item.OutcomeStatus ?? "New").toLowerCase() !== "old"
  );

  const handleLoadFromDatabase = async () => {
    setActionModalVisible(false);
    if (!restoreAllByProgram) {
      showAlert("Error", "Restore is not configured for this screen.");
      return;
    }

    try {
      setLoading(true);
      const versions = await listOutcomeCatalogVersions(type);
      const list = Array.isArray(versions) ? versions : [];
      const forProgram = list.filter(
        (v) => Number(v.sourceProgramId ?? v.SourceProgramId) === Number(targetProgramId)
      );
      const candidates = forProgram.length ? forProgram : list;

      if (!candidates.length) {
        showAlert(
          "No catalog",
          `No saved ${type} catalog version found. Import an Excel file once to create a version.`
        );
        return;
      }

      if (candidates.length === 1) {
        const result = await applyOutcomeCatalog(
          type,
          targetProgramId,
          candidates[0].outcomeCatalogVersionId ?? candidates[0].OutcomeCatalogVersionId
        );
        await loadItems({ includeArchived: false });
        showAlert(
          "Restored from database",
          `${formatRestoreSummary(result, type)} Default ${type}s loaded into database successfully.`
        );
        return;
      }

      setCatalogVersions(candidates);
      setSelectedCatalogVersionId(
        String(candidates[0].outcomeCatalogVersionId ?? candidates[0].OutcomeCatalogVersionId)
      );
      setCatalogModalVisible(true);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplySelectedCatalog = async () => {
    if (!selectedCatalogVersionId) {
      showAlert("Validation", "Select a catalog version.");
      return;
    }
    try {
      setRestoringCatalog(true);
      const result = await applyOutcomeCatalog(type, targetProgramId, selectedCatalogVersionId);
      setCatalogModalVisible(false);
      await loadItems({ includeArchived: false });
      showAlert(
        "Restored from database",
        `${formatRestoreSummary(result, type)} Applied version "${result.versionLabel || selectedCatalogVersionId}".`
      );
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setRestoringCatalog(false);
    }
  };

  useEffect(() => {
    if (!valid) return;
    loadItems({ includeArchived: false });
  }, [valid, targetProgramId]);

  if (!valid) {
    return (
      <div className="min-h-full bg-page">
        <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
          <PageBackButton className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-gray-900">{type}s</h1>
            <p className="mt-1 text-sm text-gray-500">Program not found. Open from Programs.</p>
            <button className="mt-4 font-bold text-brand" type="button" onClick={() => navigate(programsPath)}>
              Programs
            </button>
          </div>
        </div>
      </div>
    );
  }

  const openNewForm = () => {
    setEditingItem(null);
    setDescription("");
    setActionModalVisible(false);
    setFormModalVisible(true);
  };

  const openEditForm = (item) => {
    setEditingItem(item);
    setDescription(isPLO ? item.ploDescription : item.peoDescription);
    setFormModalVisible(true);
  };

  const handleSave = async () => {
    if (!description.trim()) {
      showAlert("Validation Error", `${type} description is required.`);
      return;
    }

    try {
      if (editingItem) {
        const archiveId = getArchiveId(editingItem);
        const editingOld = isOldOutcome(editingItem);
        const payload = isPLO
          ? {
              ploCode:
                editingItem.ploCode ??
                getNextOutcomeCode(
                  activeItems.filter((i) => (isPLO ? i.ploId : i.peoId) !== (isPLO ? editingItem.ploId : editingItem.peoId)),
                  "PLO"
                ),
              ploDescription: description.trim(),
            }
          : { peoCode: editingItem.peoCode, peoDescription: description.trim() };

        await updateItem(
          isPLO ? editingItem.ploId : editingItem.peoId,
          payload,
          editingOld && archiveId ? { archiveId } : undefined
        );
      } else {
        const nextCode = getNextOutcomeCode(activeItems, type);
        if (isPLO && !nextCode) {
          showAlert(
            "Validation Error",
            `This program already has ${PLO_MAX_COUNT} PLOs. Remove one before adding another.`
          );
          return;
        }

        await createItem(
          isPLO
            ? {
                programId: targetProgramId,
                ploCode: nextCode,
                ploDescription: description.trim(),
              }
            : {
                programId: targetProgramId,
                peoCode: nextCode,
                peoDescription: description.trim(),
              }
        );
      }

      setFormModalVisible(false);
      setDescription("");
      setEditingItem(null);
      await loadItems();
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const handleDelete = async (item) => {
    const isOld = isOldOutcome(item);
    const archiveId = getArchiveId(item);
    const itemId = isPLO ? item.ploId : item.peoId;

    const confirmed = isOld
      ? await showConfirm(
          `Delete ${type} permanently`,
          `This old ${type} will be removed completely from the database. This cannot be undone.`
        )
      : await showConfirm(
          `Delete ${type}`,
          `Delete this ${type}? You can restore from a previous Excel catalog via “Load from database” if one was imported.`
        );

    if (!confirmed) return;

    try {
      if (isOld && archiveId) {
        await deleteItem(itemId, { archiveId });
      } else {
        await deleteItem(itemId);
      }
      await loadItems();
    } catch (error) {
      showAlert("Error", error.message);
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

    try {
      setUploading(true);
      const result = await importItems(targetProgramId, selectedFile);

      showAlert(
        "Import Completed",
        `Inserted: ${result.insertedCount ?? result.InsertedCount ?? result.inserted ?? result.Inserted ?? 0}\nSkipped: ${result.skippedCount ?? result.SkippedCount ?? result.skipped ?? result.Skipped ?? 0}\nErrors: ${result.errorCount ?? result.ErrorCount ?? 0}`
      );

      setUploadModalVisible(false);
      setActionModalVisible(false);
      setSelectedFile(null);
      await loadItems({ includeArchived: false });
    } catch (error) {
      showAlert("Upload Error", error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative min-h-full bg-page">
      <HodMintHeader
        title={`${type}s`}
        subtitle={
          type === "PLO"
            ? "View and manage program learning outcomes."
            : "View and manage program educational objectives."
        }
        action={<AddHeaderButton label={`Add ${type}`} onClick={() => setActionModalVisible(true)} />}
        back
      />

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
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
              const code = isPLO ? item.ploCode : item.peoCode;
              const desc = isPLO ? item.ploDescription : item.peoDescription;
              const status = String(item.outcomeStatus ?? item.OutcomeStatus ?? "New");
              const isOld = isOldOutcome(item);
              const rowKey = isOld
                ? `old-${item.archiveId ?? item.ArchiveId}-${code}`
                : isPLO
                  ? item.ploId
                  : item.peoId;
              return (
                <div key={rowKey} className={`flex items-start gap-3 rounded-lg border p-4 shadow-sm ${isOld ? "border-amber-200 bg-amber-50/60" : "border-gray-200 bg-white"}`}>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          isOld ? "bg-amber-200 text-amber-900" : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {isOld ? "Old" : "New"}
                      </span>
                      {code ? (
                        <span className="inline-block rounded-full bg-lime-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                          {code}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm font-medium leading-snug text-gray-900">{desc}</p>
                  </div>
                  <ListRowActions
                    onEdit={() => openEditForm(item)}
                    onDelete={() => handleDelete(item)}
                    editLabel={`Edit ${type}`}
                    deleteLabel={isOld ? `Delete ${type} permanently` : `Delete ${type}`}
                  />
                </div>
              );
            })}
            {!items.length && (
              <p className="py-10 text-center text-sm text-gray-500">
                No {type}s yet. Add new ones or upload from file.
              </p>
            )}
          </div>
        )}
      </div>

      {actionModalVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-6 backdrop-blur-xs"
          onClick={() => setActionModalVisible(false)}
          role="presentation"
        >
          <div className="max-h-[calc(100dvh-1.5rem)] sm:max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 shadow-xl dark:bg-[#0c181a] dark:text-white" onClick={(e) => e.stopPropagation()} role="presentation">
            <h2 className="mb-4 text-center text-lg font-semibold text-gray-900 dark:text-white">{type}s</h2>
            <button
              type="button"
              onClick={() => {
                setActionModalVisible(false);
                setUploadModalVisible(true);
              }}
              className="mb-3 min-h-[44px] w-full rounded-xl py-3 font-black text-white"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              Upload {type}s from file
            </button>
            <button
              type="button"
              onClick={handleLoadFromDatabase}
              className="mb-3 min-h-[44px] w-full rounded-xl py-3 font-black text-white"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              Load {type}s from Database
            </button>
            <button
              type="button"
              onClick={openNewForm}
              className="min-h-[44px] w-full rounded-xl py-3 font-black text-white"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              Add New {type}
            </button>
            <button type="button" onClick={() => setActionModalVisible(false)} className="mt-4 min-h-[44px] w-full font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      {formModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-6 backdrop-blur-xs" onClick={() => setFormModalVisible(false)} role="presentation">
          <div className="max-h-[calc(100dvh-1.5rem)] sm:max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 shadow-xl dark:bg-[#0c181a] dark:text-white" onClick={(e) => e.stopPropagation()} role="presentation">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{editingItem ? `Edit ${type}` : `New ${type}`}</h2>
            <label className="text-sm font-extrabold text-gray-700 dark:text-gray-300">{editingItem ? `Edit ${type}` : `Enter ${type}`}</label>
            <textarea
              className="mt-2 min-h-[110px] w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm font-normal text-gray-900 placeholder:text-gray-400 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
              placeholder="e.g. The ability to think critically and perform scientific analysis."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button
              type="button"
              onClick={handleSave}
              className="mt-4 min-h-[44px] w-full rounded-xl py-3 font-black text-white"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              Save
            </button>
            <button type="button" onClick={() => setFormModalVisible(false)} className="mt-3 min-h-[44px] w-full font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      {uploadModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-6 backdrop-blur-xs" onClick={() => setUploadModalVisible(false)} role="presentation">
          <div className="max-h-[calc(100dvh-1.5rem)] sm:max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 shadow-xl dark:bg-[#0c181a] dark:text-white" onClick={(e) => e.stopPropagation()} role="presentation">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Upload New {type}s file</h2>
            <label className="flex min-h-[44px] cursor-pointer items-center rounded-lg bg-gray-100 px-3 font-bold text-gray-600 dark:bg-[#122427] dark:text-gray-300">
              <input type="file" accept=".xlsx" className="hidden" onChange={pickFile} />
              {selectedFile ? selectedFile.name : "Browse"}
            </label>
            <button
              type="button"
              onClick={handleImport}
              disabled={uploading}
              className="mt-4 min-h-[44px] w-full rounded-xl py-3 font-black text-white disabled:opacity-60"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              {uploading ? "…" : "Upload"}
            </button>
            <button type="button" onClick={() => setUploadModalVisible(false)} className="mt-3 min-h-[44px] w-full font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      {catalogModalVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-6 backdrop-blur-xs"
          onClick={() => setCatalogModalVisible(false)}
          role="presentation"
        >
          <div
            className="max-h-[calc(100dvh-1.5rem)] sm:max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 shadow-xl dark:bg-[#0c181a] dark:text-white"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Choose {type} catalog version</h2>
            <p className="mb-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">Multiple saved Excel catalogs found. Pick which one to apply.</p>
            <select
              className="min-h-[40px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
              value={selectedCatalogVersionId}
              onChange={(e) => setSelectedCatalogVersionId(e.target.value)}
            >
              {catalogVersions.map((v) => {
                const id = v.outcomeCatalogVersionId ?? v.OutcomeCatalogVersionId;
                const label =
                  v.versionLabel ??
                  v.VersionLabel ??
                  `Version ${id}`;
                const created = v.createdAt ?? v.CreatedAt;
                return (
                  <option key={id} value={String(id)}>
                    {label}
                    {created ? ` · ${new Date(created).toLocaleDateString()}` : ""}
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              onClick={handleApplySelectedCatalog}
              disabled={restoringCatalog}
              className="mt-4 min-h-[44px] w-full rounded-xl py-3 font-black text-white disabled:opacity-60"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              {restoringCatalog ? "Applying…" : "Apply catalog"}
            </button>
            <button
              type="button"
              onClick={() => setCatalogModalVisible(false)}
              className="mt-3 w-full font-bold text-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutcomeScreen;
