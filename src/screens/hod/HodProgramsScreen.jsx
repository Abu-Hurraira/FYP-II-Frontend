import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import theme from "../../styles/theme";
import { AuthContext } from "../../context/AuthContext.jsx";
import {
  createProgram,
  deleteProgram,
  getPrograms,
  updateProgram,
} from "../../api/programsApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import AddHeaderButton from "../../components/AddHeaderButton.jsx";
import ListRowActions from "../../components/ListRowActions.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";

export default function HodProgramsScreen() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [programName, setProgramName] = useState("");
  const [programCode, setProgramCode] = useState("");

  const loadPrograms = async () => {
    try {
      setLoading(true);
      const data = await getPrograms();
      setPrograms(data || []);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrograms();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setProgramName("");
    setProgramCode("");
    setModalVisible(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setProgramName(item.programName || item.ProgramName || "");
    setProgramCode(item.programCode || item.ProgramCode || "");
    setModalVisible(true);
  };

  const handleSaveProgram = async () => {
    if (!programName.trim()) {
      showAlert("Validation Error", "Program name is required.");
      return;
    }

    try {
      const payload = {
        programName: programName.trim(),
        programCode: programCode.trim() || null,
      };
      if (editing) {
        await updateProgram(editing.programId ?? editing.ProgramId, payload);
        showAlert("Saved", "Program updated.");
      } else {
        await createProgram(payload);
        showAlert("Saved", "Program created.");
      }
      setModalVisible(false);
      setEditing(null);
      setProgramName("");
      setProgramCode("");
      await loadPrograms();
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const handleDelete = async (item) => {
    if (
      !(await showConfirm(
        "Delete program",
        `Delete ${item.programName || item.ProgramName}? Related sessions/mappings may block this.`
      ))
    ) {
      return;
    }
    try {
      await deleteProgram(item.programId ?? item.ProgramId);
      showAlert("Deleted", "Program deleted.");
      await loadPrograms();
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-gray-900">Programs</h1>
          <p className="mt-0.5 text-xs text-gray-500">{user?.roleName || "HOD"}</p>
        </div>
        <AddHeaderButton label="Add Program" onClick={openAdd} />
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
          <div className="space-y-2.5 pt-2">
            {programs.map((item) => (
              <div
                key={item.programId ?? item.ProgramId}
                className="flex w-full items-center gap-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-card"
              >
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/hod/program/${item.programId ?? item.ProgramId}/menu`, {
                      state: { program: item },
                    })
                  }
                  className="min-w-0 flex-1 text-left transition hover:opacity-80"
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {item.programName || item.ProgramName}
                  </p>
                  {(item.programCode || item.ProgramCode) && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      {item.programCode || item.ProgramCode}
                    </p>
                  )}
                </button>
                <ListRowActions onEdit={() => openEdit(item)} onDelete={() => handleDelete(item)} />
              </div>
            ))}
            {programs.length === 0 && (
              <p className="py-10 text-center text-sm text-gray-500">No programs yet.</p>
            )}
          </div>
        )}
      </div>

      {modalVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6"
          onClick={() => setModalVisible(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {editing ? "Edit Program" : "Add Program"}
            </h2>
            <label className="mb-3 block text-sm font-semibold text-gray-700">
              Program name
              <input
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 placeholder:text-gray-400"
                placeholder="e.g. BS Computer Science"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
              />
            </label>
            <label className="mb-4 block text-sm font-semibold text-gray-700">
              Program code
              <input
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 placeholder:text-gray-400"
                placeholder="e.g. BSCS"
                value={programCode}
                onChange={(e) => setProgramCode(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={handleSaveProgram}
              className="app-btn-primary w-full py-3"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setModalVisible(false)}
              className="mt-3 w-full font-bold text-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
