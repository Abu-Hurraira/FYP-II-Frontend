import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import theme from "../../styles/theme";
import { AuthContext } from "../../context/AuthContext.jsx";
import { getSessions } from "../../api/sessionsApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert } from "../../utils/dialogs";

const SectionAdminSessionsScreen = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await getSessions();
      setSessions(data || []);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Sessions</h1>
          <p className="mt-0.5 text-xs text-gray-500">{user?.roleName || "SectionAdmin"}</p>
        </div>
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent" style={{ borderTopColor: theme.colors.primary }} />
          </div>
        ) : (
          <div className="space-y-2.5 pt-2">
            {sessions.map((item) => (
              <button
                key={item.sessionId}
                type="button"
                onClick={() =>
                  navigate(`/section-admin/session/${item.sessionId}/sections`, {
                    state: { session: item },
                  })
                }
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-gray-50"
              >
                <p className="text-sm font-semibold text-gray-900">{item.sessionTitle}</p>
                {item.programName ? (
                  <p className="mt-0.5 text-xs text-gray-600">{item.programName}</p>
                ) : null}
              </button>
            ))}
            {sessions.length === 0 && (
              <p className="py-10 text-center text-gray-500">No sessions found.</p>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default SectionAdminSessionsScreen;
