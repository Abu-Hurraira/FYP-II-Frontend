import React, { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import theme from "../../styles/theme";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import AddHeaderButton from "../../components/AddHeaderButton.jsx";
import ListRowActions from "../../components/ListRowActions.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";
import { sortPeos, sortPlos } from "../../utils/outcomeHelpers";
import {
  formatRestoreSummary,
  getArchiveId,
  isOldOutcome,
} from "../../utils/outcomeArchivedView";

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
  const { user } = useContext(AuthContext);
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
      const result = await restoreAllByProgram(targetProgramId);
      await loadItems({ includeArchived: false });
      showAlert(
        "Restored from database",
        `${formatRestoreSummary(result, type)} Default ${type}s loaded into database successfully.`
      );
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
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
                programId: program.programId,
                ploCode: nextCode,
                ploDescription: description.trim(),
              }
            : {
                programId: program.programId,
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
          `Move this ${type} to old versions? It will be hidden until you load from database.`
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
      const result = await importItems(program.programId, selectedFile);

      showAlert(
        "Import Completed",
        `Inserted: ${result.insertedCount}\nSkipped: ${result.skippedCount || 0}\nErrors: ${result.errorCount || 0}`
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
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-gray-900">{type}s</h1>
          <p className="mt-0.5 text-xs text-gray-500">{user?.roleName || "HOD"}</p>
        </div>
        <AddHeaderButton label={`Add ${type}`} onClick={() => setActionModalVisible(true)} />
      </div>

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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6"
          onClick={() => setActionModalVisible(false)}
          role="presentation"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} role="presentation">
            <h2 className="mb-4 text-center text-lg font-semibold text-gray-900">{type}s</h2>
            <button
              type="button"
              onClick={() => {
                setActionModalVisible(false);
                setUploadModalVisible(true);
              }}
              className="mb-3 w-full rounded-lg py-3 font-black text-white"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              Upload {type}s from file
            </button>
            <button
              type="button"
              onClick={handleLoadFromDatabase}
              className="mb-3 w-full rounded-lg py-3 font-black text-white"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              Load {type}s from Database
            </button>
            <button
              type="button"
              onClick={openNewForm}
              className="w-full rounded-lg py-3 font-black text-white"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              Add New {type}
            </button>
            <button type="button" onClick={() => setActionModalVisible(false)} className="mt-4 w-full font-bold text-gray-500">
              Cancel
            </button>
          </div>
        </div>
      )}

      {formModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6" onClick={() => setFormModalVisible(false)} role="presentation">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} role="presentation">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">{editingItem ? `Edit ${type}` : `New ${type}`}</h2>
            <label className="text-sm font-extrabold text-gray-700">{editingItem ? `Edit ${type}` : `Enter ${type}`}</label>
            <textarea
              className="mt-2 min-h-[110px] w-full rounded-lg border border-gray-200 bg-gray-50 p-3"
              placeholder="e.g The ability to think critically and perform scientific analysis."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button
              type="button"
              onClick={handleSave}
              className="mt-4 w-full rounded-lg py-3 font-black text-white"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              Save
            </button>
            <button type="button" onClick={() => setFormModalVisible(false)} className="mt-3 w-full font-bold text-gray-500">
              Cancel
            </button>
          </div>
        </div>
      )}

      {uploadModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6" onClick={() => setUploadModalVisible(false)} role="presentation">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} role="presentation">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Upload New {type}s file</h2>
            <label className="flex h-11 cursor-pointer items-center rounded-lg bg-gray-100 px-3 font-bold text-gray-600">
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={pickFile} />
              {selectedFile ? selectedFile.name : "Browse"}
            </label>
            <button
              type="button"
              onClick={handleImport}
              disabled={uploading}
              className="mt-4 w-full rounded-lg py-3 font-black text-white disabled:opacity-60"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              {uploading ? "…" : "Upload"}
            </button>
            <button type="button" onClick={() => setUploadModalVisible(false)} className="mt-3 w-full font-bold text-gray-500">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutcomeScreen;
