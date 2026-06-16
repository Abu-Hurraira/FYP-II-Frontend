import React, { useContext, useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import theme from "../../styles/theme";
import { AuthContext } from "../../context/AuthContext.jsx";
import { getSectionsBySession } from "../../api/sectionsApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert } from "../../utils/dialogs";

const SectionAdminSectionsScreen = () => {
  const { user } = useContext(AuthContext);
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = location.state || {};

  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);

  const valid = session && String(session.sessionId) === String(sessionId);

  const loadSections = async () => {
    if (!valid) return;
    try {
      setLoading(true);
      const data = await getSectionsBySession(session.sessionId);
      setSections(data || []);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSections();
  }, [valid, sessionId]);

  if (!valid) {
    return (
      <div className="min-h-full bg-page">
        <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
          <PageBackButton className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-gray-900">Sections</h1>
            <p className="mt-0.5 text-xs text-gray-500">Session missing. Open from the sessions list.</p>
            <button type="button" className="mt-4 text-sm font-semibold text-brand" onClick={() => navigate("/section-admin")}>
              Programs
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Sections</h1>
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
            {sections.map((item) => (
              <button
                key={item.sectionId}
                type="button"
                onClick={() =>
                  navigate("/section-admin/students", {
                    state: { section: item },
                  })
                }
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-gray-50"
              >
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-semibold text-gray-900">{item.sectionName}</p>
                  <p className="mt-0.5 text-xs text-gray-600">Semester: {item.semester || "Not set"}</p>
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
