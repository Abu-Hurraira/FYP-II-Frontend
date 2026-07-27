import React, { useContext, useEffect, useState } from "react";
import theme from "../../styles/theme";
import { AuthContext } from "../../context/AuthContext.jsx";
import {
  createCourse,
  deleteCourse,
  getCourses,
  importCoursesFromExcel,
  updateCourse,
} from "../../api/coursesApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import AddHeaderButton from "../../components/AddHeaderButton.jsx";
import ListRowActions from "../../components/ListRowActions.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";

export default function HodCoursesScreen() {
  const { user } = useContext(AuthContext);

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [classCreditHours, setClassCreditHours] = useState("");
  const [labCreditHours, setLabCreditHours] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const data = await getCourses();
      setCourses(data || []);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const resetForm = () => {
    setEditingCourse(null);
    setCourseTitle("");
    setCourseCode("");
    setClassCreditHours("");
    setLabCreditHours("");
    setSelectedFile(null);
  };

  const openAddModal = () => {
    resetForm();
    setFormVisible(true);
  };

  const openEditModal = (course) => {
    setEditingCourse(course);
    setCourseTitle(course.courseTitle || "");
    setCourseCode(course.courseCode || "");
    setClassCreditHours(
      course.classCreditHours !== null && course.classCreditHours !== undefined
        ? String(course.classCreditHours)
        : ""
    );
    setLabCreditHours(
      course.labCreditHours !== null && course.labCreditHours !== undefined
        ? String(course.labCreditHours)
        : ""
    );
    setFormVisible(true);
  };

  const closeFormModal = () => {
    setFormVisible(false);
    resetForm();
  };

  const parseNullableInt = (value) => {
    if (!value || !String(value).trim()) return null;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const validateCourseForm = () => {
    if (!courseTitle.trim()) {
      showAlert("Validation Error", "Course title is required.");
      return false;
    }
    if (!courseCode.trim()) {
      showAlert("Validation Error", "Course code is required.");
      return false;
    }
    return true;
  };

  const handleSaveCourse = async () => {
    if (!validateCourseForm()) return;

    const payload = {
      courseTitle: courseTitle.trim(),
      courseCode: courseCode.trim(),
      classCreditHours: parseNullableInt(classCreditHours),
      labCreditHours: parseNullableInt(labCreditHours),
    };

    try {
      setLoading(true);
      if (editingCourse) {
        await updateCourse(editingCourse.courseId, payload);
        showAlert("Success", "Course updated successfully.");
      } else {
        await createCourse(payload);
        showAlert("Success", "Course added successfully.");
      }
      closeFormModal();
      await loadCourses();
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async (course) => {
    if (
      !(await showConfirm(
        "Delete Course",
        `Are you sure you want to delete ${course.courseTitle}?`
      ))
    ) {
      return;
    }
    try {
      setLoading(true);
      await deleteCourse(course.courseId);
      showAlert("Success", "Course deleted successfully.");
      if (editingCourse?.courseId === course.courseId) {
        closeFormModal();
      }
      await loadCourses();
    } catch (error) {
      showAlert("Delete Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const pickExcelFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name?.toLowerCase().endsWith(".xlsx")) {
      showAlert("Invalid File", "Please select a .xlsx Excel file.");
      return;
    }
    setSelectedFile(file);
  };

  const handleUploadExcel = async () => {
    if (!selectedFile) {
      showAlert("No File", "Please select an Excel file first.");
      return;
    }
    try {
      setUploading(true);
      const result = await importCoursesFromExcel(selectedFile);
      showAlert(
        "Import Completed",
        `Inserted: ${result.insertedCount}\nSkipped: ${result.skippedCount}\nErrors: ${result.errorCount}`
      );
      setUploadVisible(false);
      setSelectedFile(null);
      setFormVisible(false);
      resetForm();
      await loadCourses();
    } catch (error) {
      showAlert("Upload Error", error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative min-h-full bg-page">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-gray-900">Courses</h1>
          <p className="mt-0.5 text-xs text-gray-500">{user?.roleName || "HOD"}</p>
        </div>
        <AddHeaderButton label="Add Course" onClick={openAddModal} />
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        {loading && courses.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent" style={{ borderTopColor: theme.colors.primary }} />
            <p className="mt-3 text-gray-500">Loading courses...</p>
          </div>
        ) : (
          <div className="space-y-2.5 pb-16">
            {courses.map((item) => (
              <div
                key={item.courseId}
                className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white shadow-card p-4 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{item.courseTitle}</p>
                  <p className="mt-1 text-xs text-gray-600">Code: {item.courseCode}</p>
                  <p className="mt-0.5 text-xs text-gray-600">
                    Class Credit Hours : {item.classCreditHours ?? 0}
                    {item.labCreditHours !== null && item.labCreditHours !== undefined
                      ? `, Lab Credit Hours : ${item.labCreditHours}`
                      : ""}
                  </p>
                </div>
                <ListRowActions
                  onEdit={() => openEditModal(item)}
                  onDelete={() => handleDeleteCourse(item)}
                  editLabel="Edit course"
                  deleteLabel="Delete course"
                />
              </div>
            ))}
            {courses.length === 0 && (
              <p className="py-10 text-center text-gray-500">No courses added yet.</p>
            )}
          </div>
        )}
      </div>

      {formVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={closeFormModal} role="presentation">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[#f8fafc] p-6 shadow-xl" onClick={(e) => e.stopPropagation()} role="presentation">
            <div className="relative mb-4 text-center">
              <h2 className="text-lg font-semibold text-gray-900">{editingCourse ? "Edit Course" : "Add Course"}</h2>
              <button type="button" className="absolute right-0 top-0 text-3xl text-gray-500" onClick={closeFormModal}>
                ×
              </button>
            </div>
            <label className="text-sm font-extrabold">Course Title</label>
            <input className="mb-3 mt-1 w-full rounded-lg border bg-white px-3 py-2" value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} placeholder="title" />
            <label className="text-sm font-extrabold">Course Code</label>
            <input className="mb-3 mt-1 w-full rounded-lg border bg-white px-3 py-2" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} placeholder="Course code" />
            <label className="text-sm font-extrabold">Credit Hours Class</label>
            <input className="mb-3 mt-1 w-full rounded-lg border bg-white px-3 py-2" value={classCreditHours} onChange={(e) => setClassCreditHours(e.target.value)} inputMode="numeric" />
            <label className="text-sm font-extrabold">Credit Hours Lab</label>
            <input className="mb-3 mt-1 w-full rounded-lg border bg-white px-3 py-2" value={labCreditHours} onChange={(e) => setLabCreditHours(e.target.value)} inputMode="numeric" />
            {!editingCourse && (
              <button
                type="button"
                onClick={() => setUploadVisible(true)}
                className="app-btn-primary app-btn-primary-block mb-3 w-full py-3 font-extrabold"
              >
                Upload File
              </button>
            )}
            <button type="button" onClick={handleSaveCourse} className="app-btn-primary app-btn-primary-block w-full py-3 font-extrabold">
              {editingCourse ? "Update" : "Add"}
            </button>
          </div>
        </div>
      )}

      {uploadVisible && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setUploadVisible(false)} role="presentation">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} role="presentation">
            <h2 className="text-lg font-semibold text-gray-900">Upload Courses File</h2>
            <label className="mt-4 flex h-12 cursor-pointer items-center rounded-lg bg-gray-100 px-3 text-gray-600">
              <input type="file" accept=".xlsx" className="hidden" onChange={pickExcelFile} />
              {selectedFile ? selectedFile.name : "Select .xlsx file"}
            </label>
            <button
              type="button"
              disabled={uploading}
              onClick={handleUploadExcel}
              className="mt-4 w-full rounded-lg py-3 font-extrabold text-white disabled:opacity-60"
              style={{ backgroundColor: "#1a6b45" }}
            >
              {uploading ? "…" : "⬆ Upload"}
            </button>
            <button type="button" onClick={() => setUploadVisible(false)} className="mt-3 w-full py-2 font-extrabold text-white" style={{ backgroundColor: theme.colors.primaryDark }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
