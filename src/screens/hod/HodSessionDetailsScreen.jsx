import React, { useContext, useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import theme from "../../styles/theme";
import { AuthContext } from "../../context/AuthContext.jsx";
import { createSection, getSectionsBySession } from "../../api/sectionsApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert } from "../../utils/dialogs";

export default function HodSessionDetailsScreen() {
  const { user } = useContext(AuthContext);
  const { programId, sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { program, session } = location.state || {};

  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sectionModalVisible, setSectionModalVisible] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [semester, setSemester] = useState("");

  const valid =
    program &&
    session &&
    String(program.programId) === String(programId) &&
    String(session.sessionId) === String(sessionId);

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

  const handleCreateSection = async () => {
    if (!sectionName.trim()) {
      showAlert("Validation Error", "Section name is required.");
      return;
    }

    try {
      await createSection({
        sessionId: session.sessionId,
        sectionName: sectionName.trim(),
        semester: semester.trim() ? parseInt(semester, 10) : null,
        studentListFilePath: null,
        attendanceSheetPath: null,
      });

      setSectionModalVisible(false);
      setSectionName("");
      setSemester("");
      await loadSections();
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  if (!valid) {
    return (
      <div className="min-h-full bg-page">
        <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
          <PageBackButton className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-gray-900">Session</h1>
            <p className="mt-1 text-sm text-gray-500">Session or program missing. Use navigation from Sessions.</p>
            <button type="button" className="mt-4 font-bold text-brand" onClick={() => navigate("/hod/programs")}>
              Programs
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full bg-page">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-gray-900">{session.sessionTitle}</h1>
          <p className="mt-0.5 text-xs text-gray-500">{user?.roleName || "HOD"}</p>
        </div>

        <button
          type="button"
          onClick={() =>
            navigate(`/hod/program/${program.programId}/session/${session.sessionId}/offered-courses`, {
              state: { program, session },
            })
          }
          className="rounded-2xl border border-gray-100 bg-white shadow-card px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand-muted/40"
        >
          Offered Courses
        </button>
        <button
          type="button"
          onClick={() => setSectionModalVisible(true)}
          className="app-btn-primary rounded-2xl px-4 py-2 text-sm shadow-sm"
        >
          Add Section
        </button>
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
            {sections.map((item) => (
              <div
                key={item.sectionId}
                className="w-full rounded-2xl border border-gray-100 bg-white shadow-card p-4 shadow-sm"
              >
                <p className="text-sm font-semibold text-gray-900">{item.sectionName}</p>
                <p className="mt-0.5 text-xs text-gray-500">{item.studentCount || 0} Students</p>
              </div>
            ))}
            {sections.length === 0 && (
              <p className="py-6 text-center text-sm font-medium text-gray-500">No sections created yet.</p>
            )}
          </div>
        )}
      </div>

      {sectionModalVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6"
          onClick={() => setSectionModalVisible(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Create Section</h2>
            <label className="text-sm font-extrabold">Section Name</label>
            <input
              className="mb-3 mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="eg. BSCS-1A"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
            />
            <label className="text-sm font-extrabold">Semester</label>
            <input
              className="mb-4 mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="e.g. 1 to 8"
              inputMode="numeric"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
            />
            <button
              type="button"
              onClick={handleCreateSection}
              className="w-full rounded-lg py-3 font-black text-white"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              Create Section
            </button>
            <button
              type="button"
              onClick={() => setSectionModalVisible(false)}
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
