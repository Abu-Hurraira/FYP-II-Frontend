import React, { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import theme from "../../styles/theme";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import AddHeaderButton from "../../components/AddHeaderButton.jsx";
import ListRowActions from "../../components/ListRowActions.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";
import { sortPeos, sortPlos } from "../../utils/outcomeHelpers";

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
  const valid = program && String(program.programId) === String(programId);

  const loadItems = async () => {
    if (!valid) return;
    try {
      setLoading(true);
      const data = await getItems(program.programId);
      const list = data || [];
      setItems(isPLO ? sortPlos(list) : sortPeos(list));
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [valid, programId]);

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
        await updateItem(
          isPLO ? editingItem.ploId : editingItem.peoId,
          isPLO
            ? {
                ploCode:
                  editingItem.ploCode ??
                  getNextOutcomeCode(
                    items.filter((i) => i.ploId !== editingItem.ploId),
                    "PLO"
                  ),
                ploDescription: description.trim(),
              }
            : { peoCode: editingItem.peoCode, peoDescription: description.trim() }
        );
      } else {
        const nextCode = getNextOutcomeCode(items, type);
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
    if (!(await showConfirm(`Delete ${type}`, `Are you sure you want to delete this ${type}?`))) return;
    try {
      await deleteItem(isPLO ? item.ploId : item.peoId);
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
      await loadItems();
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
              return (
                <div key={isPLO ? item.ploId : item.peoId} className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-gray-900">{desc}</p>
                    {code ? (
                      <span className="mt-2 inline-block rounded-full bg-lime-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                        {code}
                      </span>
                    ) : null}
                  </div>
                  <ListRowActions
                    onEdit={() => openEditForm(item)}
                    onDelete={() => handleDelete(item)}
                    editLabel={`Edit ${type}`}
                    deleteLabel={`Delete ${type}`}
                  />
                </div>
              );
            })}
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
              onClick={() => {
                setActionModalVisible(false);
                loadItems();
              }}
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
