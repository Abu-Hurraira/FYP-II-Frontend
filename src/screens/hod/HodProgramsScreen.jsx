import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import theme from "../../styles/theme";
import {
  createProgram,
  deleteProgram,
  getPrograms,
  updateProgram,
} from "../../api/programsApi";
import { getSessions } from "../../api/sessionsApi";
import { useHodProgram } from "../../context/HodProgramContext.jsx";
import HodMintHeader from "../../components/HodMintHeader.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";

export default function HodProgramsScreen() {
  const navigate = useNavigate();
  const { setSelectedProgramId, refreshPrograms } = useHodProgram();

  const [programs, setPrograms] = useState([]);
  const [sessionCounts, setSessionCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [programName, setProgramName] = useState("");
  const [programCode, setProgramCode] = useState("");

  const loadPrograms = async () => {
    try {
      setLoading(true);
      const [data, sessions] = await Promise.all([
        getPrograms(),
        getSessions().catch(() => []),
      ]);
      setPrograms(data || []);
      const counts = {};
      for (const session of sessions || []) {
        const id = session.programId ?? session.ProgramId;
        if (id == null) continue;
        counts[id] = (counts[id] || 0) + 1;
      }
      setSessionCounts(counts);
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
      await refreshPrograms().catch(() => {});
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
      await refreshPrograms().catch(() => {});
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const visiblePrograms = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = programs.filter((item) => {
      if (!q) return true;
      const name = String(item.programName || item.ProgramName || "").toLowerCase();
      const code = String(item.programCode || item.ProgramCode || "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
    list.sort((a, b) => {
      const an = String(a.programName || a.ProgramName || "");
      const bn = String(b.programName || b.ProgramName || "");
      return an.localeCompare(bn);
    });
    return list;
  }, [programs, search]);

  const openProgram = (item) => {
    const id = item.programId ?? item.ProgramId;
    setSelectedProgramId(id);
    navigate(`/hod/program/${id}/menu`, {
      state: { program: item },
    });
  };

  return (
    <div className="min-h-full bg-page">
      <HodMintHeader
        title="Programs"
        subtitle="Manage academic programs and their sessions."
        action={
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            <span className="text-lg leading-none">+</span>
            Add Programs
          </button>
        }
      />
      <div className="w-full space-y-4 px-4 pb-8 pt-4 sm:px-6 lg:px-8">

        <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search programs..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-600/15"
            />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : visiblePrograms.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
            {search ? "No programs match your search." : "No programs yet."}
          </p>
        ) : (
          <div className="space-y-3">
            {visiblePrograms.map((item) => {
              const id = item.programId ?? item.ProgramId;
              const name = item.programName || item.ProgramName;
              const code = item.programCode || item.ProgramCode || "";
              const sessions = sessionCounts[id] || 0;
              return (
                <article
                  key={id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openProgram(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openProgram(item);
                    }
                  }}
                  className="cursor-pointer rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-emerald-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422A12.083 12.083 0 0112 20.5a12.083 12.083 0 01-6.16-1.922L12 14z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-bold text-gray-900">{name}</h2>
                          {code ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              {code}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                          {code ? `Program Code: ${code}` : "Program"}
                          <span className="mx-2 text-gray-300">·</span>
                          Sessions: {sessions}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEdit(item);
                        }}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
                        aria-label="Edit program"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(item);
                        }}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 text-red-500 hover:bg-red-50"
                        aria-label="Delete program"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <span className="pl-1 text-xl text-gray-300">›</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {modalVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-6 backdrop-blur-xs"
          onClick={() => setModalVisible(false)}
          role="presentation"
        >
          <div
            className="max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 shadow-xl dark:bg-[#0c181a] dark:text-white"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              {editing ? "Edit Program" : "Add Program"}
            </h2>
            <label className="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Program name
              <input
                className="mt-1 min-h-[40px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                placeholder="e.g. BS Computer Science"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
              />
            </label>
            <label className="mb-4 block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Program code
              <input
                className="mt-1 min-h-[40px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                placeholder="e.g. BSCS"
                value={programCode}
                onChange={(e) => setProgramCode(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={handleSaveProgram}
              className="app-btn-primary min-h-[44px] w-full py-3"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setModalVisible(false)}
              className="mt-3 min-h-[44px] w-full font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
