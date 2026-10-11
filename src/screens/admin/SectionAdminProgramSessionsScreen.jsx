import React, { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { getPrograms } from "../../api/programsApi";
import { getSessionsByProgram } from "../../api/sessionsApi";
import theme from "../../styles/theme";
import { showAlert } from "../../utils/dialogs";

function normalizeProgram(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    ...raw,
    programId: raw.programId ?? raw.ProgramId,
    programName: raw.programName ?? raw.ProgramName ?? "Program",
    programCode: raw.programCode ?? raw.ProgramCode ?? "",
  };
}

function normalizeSession(raw) {
  if (!raw || typeof raw !== "object") return raw;
  return {
    ...raw,
    sessionId: raw.sessionId ?? raw.SessionId,
    sessionTitle: raw.sessionTitle ?? raw.SessionTitle ?? "",
    academicYear: raw.academicYear ?? raw.AcademicYear ?? "",
    programId: raw.programId ?? raw.ProgramId,
  };
}

export default function SectionAdminProgramSessionsScreen() {
  const { user } = useContext(AuthContext);
  const { programId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [program, setProgram] = useState(() => normalizeProgram(location.state?.program));
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const pid = Number(programId);
      if (!pid) return;
      try {
        setLoading(true);
        const [sessionData, programData] = await Promise.all([
          getSessionsByProgram(pid),
          program ? Promise.resolve(null) : getPrograms().catch(() => []),
        ]);
        if (!mounted) return;
        if (!program && Array.isArray(programData)) {
          const found = programData
            .map(normalizeProgram)
            .find((p) => Number(p?.programId) === pid);
          setProgram(found || { programId: pid, programName: "Program" });
        }
        setSessions((sessionData || []).map(normalizeSession));
      } catch (error) {
        showAlert("Error", error.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [programId]);

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-gray-900">{program?.programName || "Sessions"}</h1>
          <p className="mt-0.5 text-xs text-gray-500">{user?.roleName || "Admin"}</p>
        </div>
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
            {sessions.map((s) => (
              <button
                key={s.sessionId}
                type="button"
                onClick={() =>
                  navigate(`/admin/session/${s.sessionId}/sections`, {
                    state: { session: s, program },
                  })
                }
                className="flex min-h-[48px] w-full items-center justify-between rounded-2xl border border-gray-100 bg-white shadow-card px-4 py-3 text-left shadow-sm transition hover:bg-brand-muted/40"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <p className="truncate text-sm font-semibold text-gray-900">{s.sessionTitle}</p>
                  {s.academicYear ? (
                    <p className="mt-0.5 text-xs text-gray-500">{s.academicYear}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xl text-gray-300">›</span>
              </button>
            ))}

            {sessions.length === 0 && (
              <p className="mt-10 text-center font-bold text-gray-500">
                No sessions found for this program.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
