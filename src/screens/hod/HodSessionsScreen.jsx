import React, { useContext, useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import theme from "../../styles/theme";
import { AuthContext } from "../../context/AuthContext.jsx";
import {
  createSession,
  deleteSession,
  getSessionsByProgram,
  updateSession,
} from "../../api/sessionsApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import AddHeaderButton from "../../components/AddHeaderButton.jsx";
import ListRowActions from "../../components/ListRowActions.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";

const DEGREE_YEARS = 4;

function academicYearFromTitle(title) {
  const match = String(title || "").match(/\b((?:19|20)\d{2})\b/);
  if (!match) return "";
  const startYear = Number(match[1]);
  return `${startYear}-${startYear + DEGREE_YEARS}`;
}

export default function HodSessionsScreen() {
  const { user } = useContext(AuthContext);
  const { programId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const program = location.state?.program;

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [sessionTitle, setSessionTitle] = useState("");
  const [academicYear, setAcademicYear] = useState("");

  const targetProgramId = Number(programId || program?.programId);
  const effectiveProgram =
    program && String(program.programId) === String(programId)
      ? program
      : targetProgramId
        ? { programId: targetProgramId, programName: program?.programName }
        : null;

  const loadSessions = async () => {
    if (!effectiveProgram?.programId) return;
    try {
      setLoading(true);
      const data = await getSessionsByProgram(effectiveProgram.programId);
      setSessions(data || []);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [effectiveProgram?.programId]);

  const openAdd = () => {
    setEditing(null);
    setSessionTitle("");
    setAcademicYear("");
    setModalVisible(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setSessionTitle(item.sessionTitle || item.SessionTitle || "");
    setAcademicYear(item.academicYear || item.AcademicYear || "");
    setModalVisible(true);
  };

  const handleSaveSession = async () => {
    if (!sessionTitle.trim()) {
      showAlert("Validation Error", "Session title is required.");
      return;
    }

    try {
      const payload = {
        programId: effectiveProgram.programId,
        sessionTitle: sessionTitle.trim(),
        academicYear: academicYear.trim() || null,
      };
      if (editing) {
        await updateSession(editing.sessionId ?? editing.SessionId, payload);
        showAlert("Saved", "Session updated.");
      } else {
        await createSession(payload);
        showAlert("Saved", "Session created.");
      }
      setModalVisible(false);
      setEditing(null);
      setSessionTitle("");
      setAcademicYear("");
      await loadSessions();
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const handleDelete = async (item) => {
    if (
      !(await showConfirm(
        "Delete session",
        `Delete ${item.sessionTitle || item.SessionTitle}? Sections under it may block this.`
      ))
    ) {
      return;
    }
    try {
      await deleteSession(item.sessionId ?? item.SessionId);
      showAlert("Deleted", "Session deleted.");
      await loadSessions();
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  if (!effectiveProgram) {
    return (
      <div className="min-h-full bg-page">
        <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
          <PageBackButton className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-gray-900">Sessions</h1>
            <p className="mt-0.5 text-xs text-gray-500">Program not found in navigation state.</p>
            <button type="button" className="mt-4 font-bold text-brand" onClick={() => navigate("/hod/programs")}>
              Programs
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-gray-900">Sessions</h1>
          <p className="mt-0.5 text-xs text-gray-500">{user?.roleName || "HOD"}</p>
        </div>
        <AddHeaderButton label="Add Session" onClick={openAdd} />
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-10">
            <div
              className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : (
          <div className="space-y-2.5">
            {sessions.map((item) => (
              <div
                key={item.sessionId ?? item.SessionId}
                className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-card"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() =>
                    navigate(
                      `/hod/program/${effectiveProgram.programId}/session/${item.sessionId ?? item.SessionId}`,
                      { state: { program: effectiveProgram, session: item } }
                    )
                  }
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {item.sessionTitle || item.SessionTitle}
                  </p>
                  {(item.academicYear || item.AcademicYear) && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      {item.academicYear || item.AcademicYear}
                    </p>
                  )}
                </button>
                <ListRowActions onEdit={() => openEdit(item)} onDelete={() => handleDelete(item)} />
              </div>
            ))}
            {sessions.length === 0 && (
              <p className="py-6 text-center text-sm font-medium text-gray-500">No sessions yet.</p>
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
              {editing ? "Edit Session" : "Add Session"}
            </h2>
            <label className="mb-3 block text-sm font-semibold text-gray-700">
              Session title
              <input
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 placeholder:text-gray-400"
                placeholder="e.g. Spring 2026"
                value={sessionTitle}
                onChange={(e) => {
                  const nextTitle = e.target.value;
                  setSessionTitle(nextTitle);
                  const derived = academicYearFromTitle(nextTitle);
                  if (derived) setAcademicYear(derived);
                }}
              />
            </label>
            <label className="mb-4 block text-sm font-semibold text-gray-700">
              Academic year
              <input
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 placeholder:text-gray-400"
                placeholder="e.g. 2026-2030"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
              />
            </label>
            <button type="button" onClick={handleSaveSession} className="app-btn-primary w-full py-3">
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
