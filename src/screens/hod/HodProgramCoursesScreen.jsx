import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { createCourse, getCourses, importCoursesFromExcel, updateCourse } from "../../api/coursesApi";
import { applyCourseCatalog, listCourseCatalogVersions } from "../../api/courseCatalogApi";
import {
  addProgramCourse,
  getProgramCoursesForMapping,
  removeProgramCourse,
} from "../../api/ploCourseMappingApi";
import AddHeaderButton from "../../components/AddHeaderButton.jsx";
import ListRowActions from "../../components/ListRowActions.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";
import theme from "../../styles/theme";

function courseIdOf(row) {
  return Number(row?.courseId ?? row?.CourseId);
}

export default function HodProgramCoursesScreen() {
  const { user } = useContext(AuthContext);
  const { programId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const program = location.state?.program;

  const [programCourses, setProgramCourses] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionVisible, setActionVisible] = useState(false);
  const [existingVisible, setExistingVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [classCreditHours, setClassCreditHours] = useState("");
  const [labCreditHours, setLabCreditHours] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [catalogModalVisible, setCatalogModalVisible] = useState(false);
  const [catalogVersions, setCatalogVersions] = useState([]);
  const [selectedCatalogVersionId, setSelectedCatalogVersionId] = useState("");
  const [restoringCatalog, setRestoringCatalog] = useState(false);

  const valid = program && String(program.programId) === String(programId);

  const linkedIds = useMemo(() => {
    const ids = new Set();
    for (const row of programCourses) {
      const id = courseIdOf(row);
      if (id) ids.add(id);
    }
    return ids;
  }, [programCourses]);

  const unlinkedCourses = useMemo(
    () => (allCourses || []).filter((c) => !linkedIds.has(courseIdOf(c))),
    [allCourses, linkedIds]
  );

  const loadData = async () => {
    if (!valid) return;
    try {
      setLoading(true);
      const [linked, master] = await Promise.all([
        getProgramCoursesForMapping(program.programId),
        getCourses(),
      ]);
      setProgramCourses(linked || []);
      setAllCourses(master || []);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [valid, programId]);

  const resetForm = () => {
    setEditingCourse(null);
    setCourseTitle("");
    setCourseCode("");
    setClassCreditHours("");
    setLabCreditHours("");
  };

  const parseOptionalInt = (value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return null;
    const parsed = parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const linkCourse = async (courseId) => {
    try {
      await addProgramCourse(program.programId, courseId);
      return true;
    } catch (error) {
      if (String(error.message || "").toLowerCase().includes("already linked")) {
        return false;
      }
      throw error;
    }
  };

  const handleLinkOne = async (course) => {
    try {
      setSaving(true);
      const linked = await linkCourse(courseIdOf(course));
      if (linked) {
        showAlert("Added", `${course.courseTitle || course.CourseTitle} is now in this program.`);
        await loadData();
      }
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLinkAllExisting = async () => {
    if (!unlinkedCourses.length) {
      showAlert("Already done", "Every course from the Courses list is already in this program.");
      return;
    }
    try {
      setSaving(true);
      let linkedCount = 0;
      for (const course of unlinkedCourses) {
        const ok = await linkCourse(courseIdOf(course));
        if (ok) linkedCount += 1;
      }
      showAlert(
        "Catalog updated",
        `Added ${linkedCount} course(s) to ${program.programName}. You can now upload offered courses.`
      );
      setExistingVisible(false);
      setActionVisible(false);
      await loadData();
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCourse = async () => {
    if (!courseTitle.trim() || !courseCode.trim()) {
      showAlert("Validation Error", "Course title and course code are required.");
      return;
    }
    const payload = {
      courseTitle: courseTitle.trim(),
      courseCode: courseCode.trim(),
      classCreditHours: parseOptionalInt(classCreditHours),
      labCreditHours: parseOptionalInt(labCreditHours),
    };
    try {
      setSaving(true);
      if (editingCourse) {
        await updateCourse(editingCourse.courseId ?? editingCourse.CourseId, payload);
        showAlert("Success", "Course updated.");
      } else {
        const result = await createCourse(payload);
        const created = result?.course || result;
        const newId = created?.courseId ?? created?.CourseId;
        if (newId) await linkCourse(newId);
        showAlert("Success", "Course created and added to this program.");
      }
      setFormVisible(false);
      resetForm();
      await loadData();
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name?.toLowerCase().endsWith(".xlsx")) {
      showAlert("Invalid File", "Please select a .xlsx file.");
      return;
    }
    setSelectedFile(file);
  };

  const handleImport = async () => {
    if (!selectedFile) {
      showAlert("No File", "Please select a file first.");
      return;
    }
    try {
      setUploading(true);
      const result = await importCoursesFromExcel(selectedFile);
      const inserted = result.insertedCourses || result.InsertedCourses || [];
      let linkedCount = 0;
      for (const course of inserted) {
        const id = courseIdOf(course);
        if (!id) continue;
        const ok = await linkCourse(id);
        if (ok) linkedCount += 1;
      }
      showAlert(
        "Import Completed",
        `Inserted: ${result.insertedCount ?? inserted.length ?? 0}
Linked to this program: ${linkedCount}
Skipped: ${result.skippedCount ?? 0}`
      );
      setUploadVisible(false);
      setActionVisible(false);
      setSelectedFile(null);
      await loadData();
    } catch (error) {
      showAlert("Upload Error", error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLoadFromCatalog = async () => {
    setActionVisible(false);
    try {
      setSaving(true);
      const versions = await listCourseCatalogVersions();
      const list = Array.isArray(versions) ? versions : [];
      const forProgram = list.filter(
        (v) => Number(v.sourceProgramId ?? v.SourceProgramId) === Number(program.programId)
      );
      const candidates = forProgram.length ? forProgram : list;

      if (!candidates.length) {
        showAlert("No catalog", "No course catalog version found. Import courses once to create a version.");
        return;
      }

      if (candidates.length === 1) {
        const result = await applyCourseCatalog(
          program.programId,
          candidates[0].catalogVersionId ?? candidates[0].CatalogVersionId
        );
        await loadData();
        showAlert(
          "Restored from catalog",
          result.message ||
            `Added ${result.restoredCount ?? 0} course(s). Skipped ${result.skippedCount ?? 0}.`
        );
        return;
      }

      setCatalogVersions(candidates);
      setSelectedCatalogVersionId(
        String(candidates[0].catalogVersionId ?? candidates[0].CatalogVersionId)
      );
      setCatalogModalVisible(true);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleApplySelectedCourseCatalog = async () => {
    if (!selectedCatalogVersionId) {
      showAlert("Validation", "Select a catalog version.");
      return;
    }
    try {
      setRestoringCatalog(true);
      const result = await applyCourseCatalog(program.programId, selectedCatalogVersionId);
      setCatalogModalVisible(false);
      await loadData();
      showAlert(
        "Restored from catalog",
        result.message ||
          `Added ${result.restoredCount ?? 0} course(s). Skipped ${result.skippedCount ?? 0}.`
      );
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setRestoringCatalog(false);
    }
  };

  const handleRemove = async (item) => {
    const title = item.courseTitle || item.CourseTitle;
    if (!(await showConfirm("Remove course", `Remove ${title} from this program?`))) return;
    try {
      await removeProgramCourse(item.programCourseId ?? item.ProgramCourseId);
      await loadData();
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const openEdit = (item) => {
    setEditingCourse(item);
    setCourseTitle(item.courseTitle || item.CourseTitle || "");
    setCourseCode(item.courseCode || item.CourseCode || "");
    setClassCreditHours(
      item.classCreditHours != null ? String(item.classCreditHours) : ""
    );
    setLabCreditHours(item.labCreditHours != null ? String(item.labCreditHours) : "");
    setFormVisible(true);
  };

  if (!valid) {
    return (
      <div className="min-h-full bg-page">
        <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
          <PageBackButton className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-gray-900">Course catalog</h1>
            <p className="mt-0.5 text-xs text-gray-500">Open this from Programs.</p>
            <button
              type="button"
              className="mt-4 font-bold text-brand"
              onClick={() => navigate("/hod/programs")}
            >
              Back to Programs
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
          <h1 className="truncate text-xl font-semibold text-gray-900">Course catalog</h1>
          <p className="mt-0.5 truncate text-xs text-gray-500">
            {program.programName} · {user?.roleName || "HOD"}
          </p>
        </div>
        <AddHeaderButton label="Add to program" onClick={() => setActionVisible(true)} />
      </div>

      <div className="w-full px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <p className="mb-4 text-sm font-semibold text-gray-500">
          This list is the subjects for <span className="text-gray-800">{program.programName}</span>.
          The Courses page is only the master list. Link those courses here, then upload offered courses.
        </p>

        {loading ? (
          <div className="flex justify-center py-16">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : programCourses.length === 0 ? (
          <p className="py-10 text-center font-semibold text-gray-500">
            No courses in this program yet. Click Add to program and choose courses you already created.
          </p>
        ) : (
          <div className="space-y-2.5">
            {programCourses.map((item) => (
              <div
                key={item.programCourseId ?? item.ProgramCourseId}
                className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-card"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{item.courseTitle || item.CourseTitle}</p>
                  <p className="mt-1 text-sm text-gray-500">{item.courseCode || item.CourseCode}</p>
                </div>
                <ListRowActions onEdit={() => openEdit(item)} onDelete={() => handleRemove(item)} />
              </div>
            ))}
          </div>
        )}
      </div>

      {actionVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6"
          onClick={() => setActionVisible(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Add to program</h2>
            <button
              type="button"
              className="app-btn-primary mb-3 w-full py-3"
              onClick={() => {
                setActionVisible(false);
                setExistingVisible(true);
              }}
            >
              Use courses I already added
            </button>
            <button
              type="button"
              className="app-btn-primary mb-3 w-full py-3"
              onClick={() => {
                setActionVisible(false);
                resetForm();
                setFormVisible(true);
              }}
            >
              Add a new course
            </button>
            <button
              type="button"
              className="app-btn-primary mb-3 w-full py-3"
              onClick={() => {
                setActionVisible(false);
                setUploadVisible(true);
              }}
            >
              Upload Excel
            </button>
            <button
              type="button"
              className="app-btn-primary mb-3 w-full py-3"
              disabled={saving}
              onClick={handleLoadFromCatalog}
            >
              Load from database (catalog)
            </button>
            <button
              type="button"
              className="w-full font-bold text-gray-500"
              onClick={() => setActionVisible(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {existingVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6"
          onClick={() => setExistingVisible(false)}
          role="presentation"
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Courses already in the system</h2>
            <p className="mb-4 text-sm text-gray-500">
              These are from the Courses page. Add them to {program.programName}.
            </p>
            <button
              type="button"
              disabled={saving || unlinkedCourses.length === 0}
              className="app-btn-primary mb-4 w-full py-3 disabled:opacity-50"
              onClick={handleLinkAllExisting}
            >
              {saving ? "Adding…" : `Add all (${unlinkedCourses.length})`}
            </button>
            {unlinkedCourses.length === 0 ? (
              <p className="text-sm font-semibold text-gray-500">All master courses are already in this program.</p>
            ) : (
              <div className="space-y-2">
                {unlinkedCourses.map((course) => (
                  <div
                    key={courseIdOf(course)}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {course.courseTitle || course.CourseTitle}
                      </p>
                      <p className="text-xs text-gray-500">{course.courseCode || course.CourseCode}</p>
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      className="shrink-0 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-extrabold text-emerald-800 disabled:opacity-50"
                      onClick={() => handleLinkOne(course)}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              className="mt-4 w-full font-bold text-gray-500"
              onClick={() => setExistingVisible(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {formVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6"
          onClick={() => {
            setFormVisible(false);
            resetForm();
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {editingCourse ? "Edit Course" : "New Course"}
            </h2>
            <label className="text-sm font-extrabold">Course Title</label>
            <input
              className="mb-3 mt-1 w-full rounded-lg border bg-white px-3 py-2 placeholder:text-gray-400"
              placeholder="e.g. Applied Physics"
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
            />
            <label className="text-sm font-extrabold">Course Code</label>
            <input
              className="mb-3 mt-1 w-full rounded-lg border bg-white px-3 py-2 placeholder:text-gray-400"
              placeholder="e.g. PHY-101"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
            />
            <label className="text-sm font-extrabold">Class Credit Hours</label>
            <input
              className="mb-3 mt-1 w-full rounded-lg border bg-white px-3 py-2 placeholder:text-gray-400"
              placeholder="e.g. 3"
              value={classCreditHours}
              onChange={(e) => setClassCreditHours(e.target.value)}
              inputMode="numeric"
            />
            <label className="text-sm font-extrabold">Lab Credit Hours</label>
            <input
              className="mb-4 mt-1 w-full rounded-lg border bg-white px-3 py-2 placeholder:text-gray-400"
              placeholder="e.g. 1"
              value={labCreditHours}
              onChange={(e) => setLabCreditHours(e.target.value)}
              inputMode="numeric"
            />
            <button
              type="button"
              disabled={saving}
              className="app-btn-primary w-full py-3 disabled:opacity-50"
              onClick={handleSaveCourse}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="mt-3 w-full font-bold text-gray-500"
              onClick={() => {
                setFormVisible(false);
                resetForm();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {uploadVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6"
          onClick={() => setUploadVisible(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Upload catalog file</h2>
            <label className="flex h-11 cursor-pointer items-center rounded-lg bg-gray-100 px-3 font-bold text-gray-600">
              <input type="file" accept=".xlsx" className="hidden" onChange={pickFile} />
              {selectedFile ? selectedFile.name : "Browse"}
            </label>
            <button
              type="button"
              disabled={uploading}
              className="mt-4 w-full rounded-lg py-3 font-black text-white disabled:opacity-60"
              style={{ backgroundColor: theme.colors.primaryDark }}
              onClick={handleImport}
            >
              {uploading ? "…" : "Upload"}
            </button>
            <button
              type="button"
              className="mt-3 w-full font-bold text-gray-500"
              onClick={() => setUploadVisible(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {catalogModalVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6"
          onClick={() => setCatalogModalVisible(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Choose course catalog version</h2>
            <p className="mb-4 text-sm text-gray-500">Multiple saved catalogs found. Pick which one to apply.</p>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={selectedCatalogVersionId}
              onChange={(e) => setSelectedCatalogVersionId(e.target.value)}
            >
              {catalogVersions.map((v) => {
                const id = v.catalogVersionId ?? v.CatalogVersionId;
                const label = v.versionLabel ?? v.VersionLabel ?? `Version ${id}`;
                const created = v.createdAt ?? v.CreatedAt;
                return (
                  <option key={id} value={String(id)}>
                    {label}
                    {created ? ` · ${new Date(created).toLocaleDateString()}` : ""}
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              disabled={restoringCatalog}
              className="mt-4 w-full rounded-lg py-3 font-black text-white disabled:opacity-60"
              style={{ backgroundColor: theme.colors.primaryDark }}
              onClick={handleApplySelectedCourseCatalog}
            >
              {restoringCatalog ? "Applying…" : "Apply catalog"}
            </button>
            <button
              type="button"
              className="mt-3 w-full font-bold text-gray-500"
              onClick={() => setCatalogModalVisible(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
