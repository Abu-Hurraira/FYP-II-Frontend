import React, { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import theme from "../../styles/theme";
import { AuthContext } from "../../context/AuthContext.jsx";
import { getCoursesDropdown } from "../../api/coursesApi";
import { getUsersDropdownByRole } from "../../api/usersApi";
import { getSectionsBySession } from "../../api/sectionsApi";
import {
  createOfferedCourse,
  deleteOfferedCourse,
  getOfferedCoursesBySession,
  importCourseDetailsForSession,
  updateOfferedCourse,
} from "../../api/offeredCoursesApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import AddHeaderButton from "../../components/AddHeaderButton.jsx";
import ListRowActions from "../../components/ListRowActions.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";

export default function HodOfferedCoursesScreen() {
  const { user } = useContext(AuthContext);
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { session: stateSession } = location.state || {};
  const [session, setSession] = useState(
    stateSession && String(stateSession.sessionId) === String(sessionId)
      ? stateSession
      : { sessionId: Number(sessionId) }
  );

  const [offeredCourses, setOfferedCourses] = useState([]);
  const [sections, setSections] = useState([]);
  const [courses, setCourses] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addChoiceVisible, setAddChoiceVisible] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingOfferedCourse, setEditingOfferedCourse] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [pickerType, setPickerType] = useState(null);

  const loadScreenData = async () => {
    const sid = Number(session?.sessionId ?? sessionId);
    if (!sid) return;
    try {
      setLoading(true);
      const [offeredData, sectionData, courseData, facultyData] = await Promise.all([
        getOfferedCoursesBySession(sid),
        getSectionsBySession(sid),
        getCoursesDropdown(),
        getUsersDropdownByRole("Teacher"),
      ]);
      setSession((prev) => ({ ...prev, sessionId: sid }));
      setOfferedCourses(offeredData || []);
      setSections(sectionData || []);
      setCourses(
        (courseData || []).map((c) => ({
          courseId: c.value ?? c.Value ?? c.courseId ?? c.CourseId,
          courseTitle: c.label ?? c.Label ?? c.courseTitle ?? c.CourseTitle ?? "",
          courseCode: c.courseCode ?? c.CourseCode ?? "",
        }))
      );
      setFaculty(
        (facultyData || []).map((u) => ({
          userId: u.value ?? u.Value ?? u.userId ?? u.UserId,
          fullName: u.label ?? u.Label ?? u.fullName ?? u.FullName ?? "",
          email: u.email ?? u.Email ?? "",
        }))
      );
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScreenData();
  }, [sessionId]);

  const pickExcelFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name?.toLowerCase().endsWith(".xlsx")) {
      showAlert("Invalid File", "Please select a .xlsx Excel file.");
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showAlert("No File", "Please select a file first.");
      return;
    }
    try {
      setUploading(true);
      const result = await importCourseDetailsForSession(session.sessionId, selectedFile);
      const errorPreview =
        result.errors && result.errors.length > 0
          ? `\n\nErrors:\n${result.errors.slice(0, 5).join("\n")}${result.errors.length > 5 ? "\n..." : ""}`
          : "";
      showAlert(
        "Import Completed",
        `Sections Created: ${result.createdSections || 0}
Offered Courses Created: ${result.createdOfferedCourses || 0}
Updated Offered Courses: ${result.updatedOfferedCourses || 0}
Skipped: ${result.skippedCount || 0}
Errors: ${result.errorCount || 0}${errorPreview}`
      );
      setUploadModalVisible(false);
      setAddChoiceVisible(false);
      setSelectedFile(null);
      await loadScreenData();
    } catch (error) {
      showAlert("Upload Error", error.message);
    } finally {
      setUploading(false);
    }
  };

  const resetManualForm = () => {
    setEditingOfferedCourse(null);
    setSelectedTeacher(null);
    setSelectedCourse(null);
    setSelectedSection(null);
  };

  const openManualModal = (item = null) => {
    if (item) {
      setEditingOfferedCourse(item);
      setSelectedTeacher(faculty.find((f) => f.userId === item.teacherUserId) || null);
      setSelectedCourse(courses.find((c) => c.courseId === item.courseId) || null);
      setSelectedSection(sections.find((s) => s.sectionId === item.sectionId) || null);
    } else {
      resetManualForm();
    }
    setAddChoiceVisible(false);
    setManualModalVisible(true);
  };

  const handleSaveManualOfferedCourse = async () => {
    if (!selectedTeacher) {
      showAlert("Validation Error", "Please select teacher.");
      return;
    }
    if (!selectedCourse) {
      showAlert("Validation Error", "Please select course.");
      return;
    }
    if (!selectedSection) {
      showAlert("Validation Error", "Please select section.");
      return;
    }
    try {
      const payload = {
        teacherUserId: selectedTeacher.userId,
        courseId: selectedCourse.courseId,
        sectionId: selectedSection.sectionId,
      };
      if (editingOfferedCourse) {
        await updateOfferedCourse(editingOfferedCourse.offeredCourseId, payload);
        showAlert("Success", "Offered course updated successfully.");
      } else {
        await createOfferedCourse(payload);
        showAlert("Success", "Offered course added successfully.");
      }
      setManualModalVisible(false);
      resetManualForm();
      await loadScreenData();
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const handleDeleteOfferedCourse = async (item) => {
    if (!(await showConfirm("Delete Offered Course", "Are you sure you want to delete this offered course?"))) return;
    try {
      await deleteOfferedCourse(item.offeredCourseId);
      if (editingOfferedCourse?.offeredCourseId === item.offeredCourseId) {
        setManualModalVisible(false);
        resetManualForm();
      }
      await loadScreenData();
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const openUploadModal = () => {
    setAddChoiceVisible(false);
    setUploadModalVisible(true);
  };

  const getPickerData = () => {
    if (pickerType === "teacher") return faculty;
    if (pickerType === "course") return courses;
    if (pickerType === "section") return sections;
    return [];
  };

  const getPickerTitle = () => {
    if (pickerType === "teacher") return "Select Teacher";
    if (pickerType === "course") return "Select Course";
    if (pickerType === "section") return "Select Section";
    return "Select";
  };

  const getPickerLabel = (item) => {
    if (pickerType === "teacher") return `${item.fullName} (${item.email})`;
    if (pickerType === "course") return `${item.courseTitle} (${item.courseCode})`;
    if (pickerType === "section") return item.sectionName;
    return "";
  };

  const handlePickerSelect = (item) => {
    if (pickerType === "teacher") setSelectedTeacher(item);
    if (pickerType === "course") setSelectedCourse(item);
    if (pickerType === "section") setSelectedSection(item);
    setPickerType(null);
  };

  return (
    <div className="relative min-h-full bg-page">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-gray-900">Offered Courses</h1>
          <p className="mt-0.5 text-xs text-gray-500">{user?.roleName || "HOD"}</p>
        </div>
        <AddHeaderButton label="Add Offered Course" onClick={() => setAddChoiceVisible(true)} />
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent" style={{ borderTopColor: theme.colors.primary }} />
          </div>
        ) : (
          <div className="space-y-2.5 pb-16">
            {offeredCourses.map((item) => (
              <div
                key={item.offeredCourseId}
                className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white shadow-card p-4 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{item.sectionName}</p>
                  <p className="mt-0.5 text-xs text-gray-700">
                    {item.courseTitle} {item.courseCode ? `(${item.courseCode})` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">{item.teacherName}</p>
                </div>
                <ListRowActions
                  onEdit={() => openManualModal(item)}
                  onDelete={() => handleDeleteOfferedCourse(item)}
                  editLabel="Edit offered course"
                  deleteLabel="Delete offered course"
                />
              </div>
            ))}
            {offeredCourses.length === 0 && (
              <p className="py-10 text-center text-gray-500">No offered courses yet.</p>
            )}
          </div>
        )}
      </div>

      {addChoiceVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-4 backdrop-blur-xs" onClick={() => setAddChoiceVisible(false)} role="presentation">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 shadow-xl dark:bg-[#0c181a] dark:text-white" onClick={(e) => e.stopPropagation()} role="presentation">
            <h2 className="mb-4 text-center text-lg font-semibold text-gray-900 dark:text-white">Add Offered Courses</h2>
            <button type="button" onClick={openUploadModal} className="mb-3 min-h-[44px] w-full rounded-xl py-3 font-black text-white" style={{ backgroundColor: theme.colors.primaryDark }}>
              Upload Offered Courses File
            </button>
            <button type="button" onClick={() => openManualModal()} className="min-h-[44px] w-full rounded-xl py-3 font-black text-white" style={{ backgroundColor: theme.colors.primaryDark }}>
              New Offered Course
            </button>
            <button type="button" onClick={() => setAddChoiceVisible(false)} className="mt-4 min-h-[44px] w-full font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      {uploadModalVisible && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/55 p-3 sm:p-4 backdrop-blur-xs" onClick={() => setUploadModalVisible(false)} role="presentation">
          <div className="max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 shadow-xl dark:bg-[#0c181a] dark:text-white" onClick={(e) => e.stopPropagation()} role="presentation">
            <h2 className="mb-4 text-center text-lg font-semibold text-gray-900 dark:text-white">Upload Offered Courses File</h2>
            <label className="flex min-h-[44px] cursor-pointer items-center rounded-lg bg-gray-100 px-3 text-sm text-gray-700 dark:bg-[#122427] dark:text-gray-300">
              <input type="file" accept=".xlsx" className="hidden" onChange={pickExcelFile} />
              {selectedFile ? selectedFile.name : "Browse"}
            </label>
            <button type="button" disabled={uploading} onClick={handleUpload} className="mt-4 min-h-[44px] w-full rounded-xl py-3 font-black text-white disabled:opacity-60" style={{ backgroundColor: theme.colors.primaryDark }}>
              {uploading ? "…" : "Save"}
            </button>
            <button type="button" onClick={() => setUploadModalVisible(false)} className="mt-3 min-h-[44px] w-full font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      {manualModalVisible && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/55 p-3 sm:p-4 backdrop-blur-xs" onClick={() => setManualModalVisible(false)} role="presentation">
          <div className="max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-xl dark:bg-[#0c181a] dark:text-white" onClick={(e) => e.stopPropagation()} role="presentation">
            <h2 className="mb-4 text-center text-lg font-semibold text-gray-900 dark:text-white">{editingOfferedCourse ? "Edit Offered Course" : "Add New Offered Course"}</h2>
            <label className="text-sm font-extrabold text-gray-700 dark:text-gray-300">Select Teacher</label>
            <button type="button" onClick={() => setPickerType("teacher")} className="mb-3 mt-1 flex min-h-[44px] w-full items-center rounded-lg bg-gray-100 px-3 text-left text-sm text-gray-700 hover:bg-gray-200 dark:bg-[#122427] dark:text-gray-200">
              {selectedTeacher ? selectedTeacher.fullName : "Choose teacher"}
            </button>
            <label className="text-sm font-extrabold text-gray-700 dark:text-gray-300">Select Course</label>
            <button type="button" onClick={() => setPickerType("course")} className="mb-3 mt-1 flex min-h-[44px] w-full items-center rounded-lg bg-gray-100 px-3 text-left text-sm text-gray-700 hover:bg-gray-200 dark:bg-[#122427] dark:text-gray-200">
              {selectedCourse ? selectedCourse.courseTitle : "Choose course"}
            </button>
            <label className="text-sm font-extrabold text-gray-700 dark:text-gray-300">Select Section</label>
            <button type="button" onClick={() => setPickerType("section")} className="mb-3 mt-1 flex min-h-[44px] w-full items-center rounded-lg bg-gray-100 px-3 text-left text-sm text-gray-700 hover:bg-gray-200 dark:bg-[#122427] dark:text-gray-200">
              {selectedSection ? selectedSection.sectionName : "Choose section"}
            </button>
            <button type="button" onClick={handleSaveManualOfferedCourse} className="min-h-[44px] w-full rounded-xl py-3 font-black text-white" style={{ backgroundColor: theme.colors.primaryDark }}>
              {editingOfferedCourse ? "Save" : "Add"}
            </button>
            <button type="button" onClick={() => setManualModalVisible(false)} className="mt-3 min-h-[44px] w-full font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      {pickerType !== null && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/55 p-0 sm:p-4 backdrop-blur-xs" onClick={() => setPickerType(null)} role="presentation">
          <div className="flex max-h-[85dvh] sm:max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl dark:bg-[#0c181a] dark:text-white" onClick={(e) => e.stopPropagation()} role="presentation">
            <div className="border-b p-4 text-center dark:border-[#1b2c2e]">
              <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-600 sm:hidden" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{getPickerTitle()}</h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {getPickerData().map((item) => (
                <button
                  key={
                    pickerType === "teacher"
                      ? String(item.userId)
                      : pickerType === "course"
                        ? String(item.courseId)
                        : String(item.sectionId)
                  }
                  type="button"
                  onClick={() => handlePickerSelect(item)}
                  className="block w-full border-b border-gray-100 px-4 py-3 text-left text-sm text-gray-800 hover:bg-brand-muted/40 dark:border-[#1b2c2e] dark:text-gray-200"
                >
                  {getPickerLabel(item)}
                </button>
              ))}
            </div>
            <div className="border-t p-3 dark:border-[#1b2c2e]">
              <button type="button" onClick={() => setPickerType(null)} className="min-h-[44px] w-full rounded-xl py-3 font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
