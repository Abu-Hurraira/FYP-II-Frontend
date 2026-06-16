import React, { useContext, useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import theme from "../../styles/theme";
import { AuthContext } from "../../context/AuthContext.jsx";
import { createSession, getSessionsByProgram } from "../../api/sessionsApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import AddHeaderButton from "../../components/AddHeaderButton.jsx";
import { showAlert } from "../../utils/dialogs";

export default function HodSessionsScreen() {
  const { user } = useContext(AuthContext);
  const { programId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const program = location.state?.program;

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [academicYear, setAcademicYear] = useState("");

  const effectiveProgram = program && String(program.programId) === String(programId) ? program : null;

  const loadSessions = async () => {
    if (!effectiveProgram) return;
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

  const handleCreateSession = async () => {
    if (!sessionTitle.trim()) {
      showAlert("Validation Error", "Session title is required.");
      return;
    }

    try {
      await createSession({
        programId: effectiveProgram.programId,
        sessionTitle: sessionTitle.trim(),
        academicYear: academicYear.trim() || null,
      });

      setModalVisible(false);
      setSessionTitle("");
      setAcademicYear("");
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
        <AddHeaderButton label="Add Session" onClick={() => setModalVisible(true)} />
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
              <button
                key={item.sessionId}
                type="button"
                onClick={() =>
                  navigate(`/hod/program/${effectiveProgram.programId}/session/${item.sessionId}`, {
                    state: { program: effectiveProgram, session: item },
                  })
                }
                className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:bg-gray-50"
              >
                <p className="text-sm font-semibold text-gray-900">{item.sessionTitle}</p>
                <p className="mt-0.5 text-xs text-gray-600">{item.academicYear}</p>
                <p className="mt-0.5 text-xs text-gray-500">{effectiveProgram.programName}</p>
              </button>
            ))}
            {sessions.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-500">No sessions added yet.</p>
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
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Create Session</h2>
            <label className="text-sm font-extrabold">Session Title</label>
            <input
              className="mb-3 mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="eg. Fall 2026"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
            />
            <label className="text-sm font-extrabold">Academic Year</label>
            <input
              className="mb-4 mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="eg. 2026-2030"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
            />
            <button
              type="button"
              onClick={handleCreateSession}
              className="w-full rounded-lg py-3 font-black text-white"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              Create Session
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
