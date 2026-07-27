import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import theme from "../../styles/theme";
import { AuthContext } from "../../context/AuthContext.jsx";
import { createProgram, getPrograms } from "../../api/programsApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import AddHeaderButton from "../../components/AddHeaderButton.jsx";
import { showAlert } from "../../utils/dialogs";

export default function HodProgramsScreen() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
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

  const handleCreateProgram = async () => {
    if (!programName.trim()) {
      showAlert("Validation Error", "Program name is required.");
      return;
    }

    try {
      await createProgram({
        programName: programName.trim(),
        programCode: programCode.trim() || null,
      });

      setModalVisible(false);
      setProgramName("");
      setProgramCode("");
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
        <AddHeaderButton label="Add Program" onClick={() => setModalVisible(true)} />
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
              <button
                key={item.programId}
                type="button"
                onClick={() =>
                  navigate(`/hod/program/${item.programId}/menu`, { state: { program: item } })
                }
                className="flex min-h-[48px] w-full items-center justify-between rounded-2xl border border-gray-100 bg-white shadow-card px-4 py-3 text-left shadow-sm transition hover:bg-brand-muted/40"
              >
                <span className="truncate text-sm font-semibold text-gray-900">{item.programName}</span>
                <span className="shrink-0 text-xl text-gray-300">›</span>
              </button>
            ))}
            {programs.length === 0 && (
              <p className="mt-10 text-center font-bold text-gray-500">No programs added yet.</p>
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
            <h2 className="mb-3 text-center text-lg font-semibold text-gray-900">Create Program</h2>
            <label className="text-sm font-extrabold text-gray-800">Program Name</label>
            <input
              className="mb-4 mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
              placeholder="e.g. Computer Science"
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
            />
            <label className="text-sm font-extrabold text-gray-800">Program Code</label>
            <input
              className="mb-4 mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
              placeholder="e.g. BSCS"
              value={programCode}
              onChange={(e) => setProgramCode(e.target.value)}
            />
            <button
              type="button"
              onClick={handleCreateProgram}
              className="w-full rounded-lg py-3 font-black text-white"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              Create Program
            </button>
            <button
              type="button"
              onClick={() => setModalVisible(false)}
              className="mt-3 w-full text-center font-bold text-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
