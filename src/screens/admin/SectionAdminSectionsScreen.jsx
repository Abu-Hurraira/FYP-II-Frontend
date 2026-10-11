import React, { useContext, useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import theme from "../../styles/theme";
import { AuthContext } from "../../context/AuthContext.jsx";
import { getSectionsBySession } from "../../api/sectionsApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert } from "../../utils/dialogs";

/** Infer semester from names like BCS-1A / BSSE-2B when DB value is missing. */
function resolveSemester(section) {
  const raw = section?.semester ?? section?.Semester;
  if (raw != null && raw !== "" && Number(raw) > 0) return Number(raw);

  const name = String(section?.sectionName ?? section?.SectionName ?? "");
  const dashed = name.match(/[-_](\d+)[A-Za-z]?\b/);
  if (dashed) return Number(dashed[1]);
  const trailing = name.match(/(\d+)[A-Za-z]$/);
  if (trailing) return Number(trailing[1]);
  return null;
}

const SectionAdminSectionsScreen = () => {
  const { user } = useContext(AuthContext);
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { session: stateSession, program } = location.state || {};
  const session = stateSession && String(stateSession.sessionId ?? stateSession.SessionId) === String(sessionId)
    ? stateSession
    : { sessionId: Number(sessionId), programId: program?.programId };

  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadSections = async () => {
    const sid = Number(sessionId);
    if (!sid) return;
    try {
      setLoading(true);
      const data = await getSectionsBySession(sid);
      setSections(
        (data || []).map((item) => ({
          ...item,
          sectionId: item.sectionId ?? item.SectionId,
          sectionName: item.sectionName ?? item.SectionName ?? "",
          sessionId: item.sessionId ?? item.SessionId ?? sid,
          semester: item.semester ?? item.Semester,
          studentCount: item.studentCount ?? item.StudentCount ?? 0,
        }))
      );
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSections();
  }, [sessionId]);

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Sections</h1>
          <p className="mt-0.5 text-xs text-gray-500">{user?.roleName || "SectionAdmin"}</p>
        </div>
        <button
          type="button"
          onClick={() =>
            navigate("/admin/enrollment", {
              state: {
                programId: session.programId ?? program?.programId,
                sessionId: session.sessionId,
                session,
                program,
              },
            })
          }
          className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-brand-muted/40"
        >
          Course enrollment
        </button>
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent" style={{ borderTopColor: theme.colors.primary }} />
          </div>
        ) : (
          <div className="space-y-2.5 pt-2">
            {sections.map((item) => (
              <button
                key={item.sectionId}
                type="button"
                onClick={() =>
                  navigate("/admin/students", {
                    state: { section: item },
                  })
                }
                className="flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-white shadow-card px-4 py-3 text-left shadow-sm transition hover:bg-brand-muted/40"
              >
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-semibold text-gray-900">{item.sectionName}</p>
                  <p className="mt-0.5 text-xs text-gray-600">
                    Semester: {resolveSemester(item) ?? "Not set"}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {item.studentCount ?? item.StudentCount ?? 0} Students
                  </p>
                </div>
                <span className="shrink-0 text-xl text-gray-300">›</span>
              </button>
            ))}
            {sections.length === 0 && (
              <p className="mt-10 text-center font-bold text-gray-500">No sections found.</p>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default SectionAdminSectionsScreen;
