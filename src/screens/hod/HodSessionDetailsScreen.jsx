import React, { useContext, useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import theme from "../../styles/theme";
import { AuthContext } from "../../context/AuthContext.jsx";
import { createSection, deleteSection, getSectionsBySession, updateSection, uploadAttendanceSheet } from "../../api/sectionsApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import ListRowActions from "../../components/ListRowActions.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";

export default function HodSessionDetailsScreen() {
  const { user } = useContext(AuthContext);
  const { programId, sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { program, session } = location.state || {};

  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sectionModalVisible, setSectionModalVisible] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [sectionName, setSectionName] = useState("");
  const [semester, setSemester] = useState("");
  const [attendanceFile, setAttendanceFile] = useState(null);
  const [uploadingAttendance, setUploadingAttendance] = useState(false);

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

  const openAddSection = () => {
    setEditingSection(null);
    setSectionName("");
    setSemester("");
    setAttendanceFile(null);
    setSectionModalVisible(true);
  };

  const openEditSection = (item) => {
    setEditingSection(item);
    setSectionName(item.sectionName || item.SectionName || "");
    setSemester(
      item.semester != null || item.Semester != null
        ? String(item.semester ?? item.Semester)
        : ""
    );
    setAttendanceFile(null);
    setSectionModalVisible(true);
  };

  const handleSaveSection = async () => {
    if (!sectionName.trim()) {
      showAlert("Validation Error", "Section name is required.");
      return;
    }

    try {
      const payload = {
        sessionId: session.sessionId,
        sectionName: sectionName.trim(),
        semester: semester.trim() ? parseInt(semester, 10) : null,
        studentListFilePath: editingSection?.studentListFilePath ?? null,
        attendanceSheetPath: editingSection?.attendanceSheetPath ?? null,
      };
      let sectionId = editingSection?.sectionId ?? editingSection?.SectionId;
      if (editingSection) {
        await updateSection(sectionId, payload);
      } else {
        const created = await createSection({
          ...payload,
          studentListFilePath: null,
          attendanceSheetPath: null,
        });
        sectionId = created?.sectionId ?? created?.SectionId ?? sectionId;
      }

      if (attendanceFile && sectionId) {
        setUploadingAttendance(true);
        await uploadAttendanceSheet(sectionId, attendanceFile);
      }

      showAlert(
        "Saved",
        attendanceFile
          ? editingSection
            ? "Section updated and attendance sheet uploaded."
            : "Section created and attendance sheet uploaded."
          : editingSection
            ? "Section updated."
            : "Section created."
      );

      setSectionModalVisible(false);
      setEditingSection(null);
      setSectionName("");
      setSemester("");
      setAttendanceFile(null);
      await loadSections();
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setUploadingAttendance(false);
    }
  };

  const handleDeleteSection = async (item) => {
    if (
      !(await showConfirm(
        "Delete section",
        `Delete ${item.sectionName || item.SectionName}? Students may block this.`
      ))
    ) {
      return;
    }
    try {
      await deleteSection(item.sectionId ?? item.SectionId);
      showAlert("Deleted", "Section deleted.");
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
          onClick={openAddSection}
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
                className="flex w-full items-center gap-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-card"
              >
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/hod/program/${program.programId}/session/${session.sessionId}/section/${item.sectionId}/students`, {
                      state: {
                        program,
                        session,
                        section: {
                          ...item,
                          sessionId: session.sessionId,
                        },
                      },
                    })
                  }
                  className="min-w-0 flex-1 text-left transition hover:bg-brand-muted/20"
                >
                  <p className="text-sm font-semibold text-gray-900">{item.sectionName}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{item.studentCount || 0} Students</p>
                </button>
                <ListRowActions
                  onEdit={() => openEditSection(item)}
                  onDelete={() => handleDeleteSection(item)}
                />
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-6 backdrop-blur-xs"
          onClick={() => setSectionModalVisible(false)}
          role="presentation"
        >
          <div
            className="max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 shadow-xl dark:bg-[#0c181a] dark:text-white"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
              {editingSection ? "Edit Section" : "Create Section"}
            </h2>
            <label className="text-sm font-extrabold text-gray-700 dark:text-gray-300">Section Name</label>
            <input
              className="mb-3 mt-1 min-h-[40px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
              placeholder="e.g. BSCS-1A"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
            />
            <label className="text-sm font-extrabold text-gray-700 dark:text-gray-300">Semester</label>
            <input
              className="mb-3 mt-1 min-h-[40px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
              placeholder="e.g. 1 to 8"
              inputMode="numeric"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
            />
            <label className="text-sm font-extrabold text-gray-700 dark:text-gray-300">Attendance sheet (optional)</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="mb-1 mt-1 w-full text-sm text-gray-600 dark:text-gray-300"
              onChange={(e) => setAttendanceFile(e.target.files?.[0] || null)}
            />
            {(editingSection?.attendanceSheetPath || editingSection?.AttendanceSheetPath) && !attendanceFile ? (
              <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">A sheet is already on file. Choose a new file to replace it.</p>
            ) : (
              <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">Upload Excel/CSV for this section’s roster attendance archive.</p>
            )}
            <button
              type="button"
              onClick={handleSaveSection}
              disabled={uploadingAttendance}
              className="min-h-[44px] w-full rounded-xl py-3 font-black text-white disabled:opacity-50"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              {uploadingAttendance
                ? "Uploading…"
                : editingSection
                  ? "Save Section"
                  : "Create Section"}
            </button>
            <button
              type="button"
              onClick={() => setSectionModalVisible(false)}
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
