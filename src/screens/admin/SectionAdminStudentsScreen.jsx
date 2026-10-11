import React, { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import theme from "../../styles/theme";
import { AuthContext } from "../../context/AuthContext.jsx";
import {
  createStudent,
  deleteStudent,
  getStudentsBySection,
  importStudentsBySection,
  updateStudent,
} from "../../api/studentsApi";
import { getSectionsBySession } from "../../api/sectionsApi";
import { STUDENT_IMPORT_SAMPLE_ROWS } from "../../utils/studentImportHelpers";
import { deleteUser, getGraderUsers } from "../../api/usersApi";
import { deleteGraderAllocation, getGraderAllocations } from "../../api/graderAllocationsApi";
import { filterGradersLinkedToStudents, findGraderAllocationForStudent, findGraderUserForStudent, getAssignedTeacherName } from "../../utils/graderHelpers";
import AppSelect from "../../components/AppSelect.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import AddHeaderButton from "../../components/AddHeaderButton.jsx";
import GraderBadge from "../../components/GraderBadge.jsx";
import ListRowActions from "../../components/ListRowActions.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";

function pickPositiveId(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

const SectionAdminStudentsScreen = () => {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const { section } = location.state || {};

  const [students, setStudents] = useState([]);
  const [graders, setGraders] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [choiceVisible, setChoiceVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [fullName, setFullName] = useState("");
  const [aridNo, setAridNo] = useState("");
  const [email, setEmail] = useState("");
  const [formSectionId, setFormSectionId] = useState("");
  const [sessionSections, setSessionSections] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentSectionId = pickPositiveId(section?.sectionId, section?.SectionId);
  const currentSessionId = pickPositiveId(section?.sessionId, section?.SessionId);
  const currentSectionName = section?.sectionName ?? section?.SectionName ?? "";

  const loadStudents = async () => {
    if (!currentSectionId) return;
    try {
      setLoading(true);
      const [data, graderData, allocationData] = await Promise.all([
        getStudentsBySection(currentSectionId),
        getGraderUsers(),
        getGraderAllocations(),
      ]);
      const sectionStudents = data || [];
      setStudents(sectionStudents);
      setGraders(filterGradersLinkedToStudents(graderData || [], sectionStudents));
      setAllocations(allocationData || []);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSessionSections = async () => {
    if (!currentSessionId) {
      setSessionSections(section ? [section] : []);
      return;
    }
    try {
      const list = (await getSectionsBySession(currentSessionId)) || [];
      setSessionSections(list);
    } catch {
      setSessionSections(section ? [section] : []);
    }
  };

  useEffect(() => {
    loadStudents();
    loadSessionSections();
  }, [currentSectionId, currentSessionId]);

  const resetForm = () => {
    setEditingStudent(null);
    setFullName("");
    setAridNo("");
    setEmail("");
    setFormSectionId(currentSectionId ? String(currentSectionId) : "");
  };

  const openAdd = () => {
    resetForm();
    setChoiceVisible(false);
    setFormVisible(true);
  };

  const openEdit = (item) => {
    setEditingStudent(item);
    setFullName(item.fullName ?? item.FullName ?? "");
    setAridNo(item.aridNo ?? item.AridNo ?? "");
    setEmail(item.email ?? item.Email ?? "");
    setFormSectionId(
      String(
        pickPositiveId(item.sectionId, item.SectionId, currentSectionId) || ""
      )
    );
    setFormVisible(true);
  };

  const saveStudent = async () => {
    const sectionId = pickPositiveId(formSectionId, currentSectionId);
    if (!sectionId) {
      showAlert("Validation Error", "Section is required.");
      return;
    }
    if (!fullName.trim()) {
      showAlert("Validation Error", "Student name is required.");
      return;
    }
    if (!aridNo.trim()) {
      showAlert("Validation Error", "ARID / Registration number is required.");
      return;
    }
    const payload = {
      sectionId,
      fullName: fullName.trim(),
      aridNo: aridNo.trim(),
      email: email.trim() || null,
    };
    try {
      setSaving(true);
      if (editingStudent) {
        await updateStudent(editingStudent.studentId ?? editingStudent.StudentId, payload);
      } else {
        await createStudent(payload);
      }
      setFormVisible(false);
      resetForm();
      await loadStudents();
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  const removeStudent = async (student) => {
    const graderUser = findGraderUserForStudent(student, graders);
    const confirmMessage = graderUser
      ? `Delete ${student.fullName}? Their grader user account will also be removed.`
      : `Delete ${student.fullName}?`;

    if (!(await showConfirm("Delete Student", confirmMessage))) return;

    try {
      await deleteStudent(student.studentId ?? student.StudentId);

      if (graderUser?.userId) {
        try {
          const graderAllocations = await getGraderAllocations();
          const related = (graderAllocations || []).filter(
            (item) => Number(item.graderUserId ?? item.GraderUserId) === Number(graderUser.userId)
          );
          for (const allocation of related) {
            await deleteGraderAllocation(allocation.graderAllocationId ?? allocation.GraderAllocationId);
          }
          await deleteUser(graderUser.userId);
        } catch (graderError) {
          showAlert(
            "Student deleted",
            `The student was removed, but the grader account could not be deleted: ${graderError.message}`
          );
        }
      }

      if ((editingStudent?.studentId ?? editingStudent?.StudentId) === (student.studentId ?? student.StudentId)) {
        setFormVisible(false);
        resetForm();
      }
      await loadStudents();
    } catch (error) {
      showAlert("Error", error.message);
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

  const uploadStudents = async () => {
    if (!selectedFile) {
      showAlert("No File", "Please select a file first.");
      return;
    }
    try {
      setUploading(true);
      const result = await importStudentsBySection(currentSectionId, selectedFile);
      const inserted = result.insertedCount ?? result.InsertedCount ?? 0;
      const updated = result.updatedCount ?? result.UpdatedCount ?? 0;
      const skipped = result.skippedCount ?? result.SkippedCount ?? 0;
      const errors = result.errors ?? result.Errors ?? [];
      const warnings = result.warnings ?? result.Warnings ?? [];
      const errorPreview =
        errors.length > 0
          ? `\n\nErrors:\n${errors.slice(0, 5).join("\n")}${errors.length > 5 ? "\n..." : ""}`
          : "";
      const warningPreview =
        warnings.length > 0
          ? `\n\nWarnings:\n${warnings.slice(0, 3).join("\n")}`
          : "";
      showAlert(
        "Import Completed",
        `Inserted: ${inserted}
Updated: ${updated}
Skipped: ${skipped}
Errors: ${result.errorCount ?? errors.length ?? 0}${errorPreview}${warningPreview}`
      );
      setUploadVisible(false);
      setChoiceVisible(false);
      setSelectedFile(null);
      await loadStudents();
    } catch (error) {
      showAlert("Upload Error", error.message);
    } finally {
      setUploading(false);
    }
  };

  if (!section) {
    return (
      <div className="min-h-full bg-page">
        <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
          <PageBackButton className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-gray-900">Students</h1>
            <p className="mt-0.5 text-xs text-gray-500">Section not found. Navigate from section list.</p>
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
          <h1 className="truncate text-xl font-semibold text-gray-900">{currentSectionName || "Students"}</h1>
          <p className="mt-0.5 text-xs text-gray-500">{user?.roleName || "SectionAdmin"}</p>
        </div>
        <AddHeaderButton label="Add Student" onClick={() => setChoiceVisible(true)} />
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent" style={{ borderTopColor: theme.colors.primary }} />
          </div>
        ) : (
          <div className="space-y-2.5 pb-24 pt-2">
            {students.map((item) => {
              const graderAllocation = findGraderAllocationForStudent(item, graders, allocations);
              const assignedTeacher = getAssignedTeacherName(graderAllocation);
              const isAssignedGrader = Boolean(assignedTeacher);
              return (
                <div
                  key={item.studentId}
                  className="flex items-start gap-3 rounded-2xl border p-4 shadow-sm transition-all"
                  style={
                    isAssignedGrader
                      ? {
                          backgroundColor: "var(--brand-muted)",
                          borderColor: "var(--brand-soft)",
                        }
                      : {
                          backgroundColor: "var(--surface)",
                          borderColor: "var(--border)",
                        }
                  }
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
                        {item.fullName}
                      </p>
                      {isAssignedGrader ? <GraderBadge /> : null}
                    </div>
                    <p className="mt-0.5 text-xs font-semibold" style={{ color: "var(--text)" }}>
                      {item.aridNo}
                    </p>
                    {item.email ? (
                      <p className="mt-0.5 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                        {item.email}
                      </p>
                    ) : null}
                    {isAssignedGrader ? (
                      <p className="mt-1.5 text-xs font-bold" style={{ color: "var(--brand)" }}>
                        Assigned to teacher: {assignedTeacher}
                      </p>
                    ) : null}
                  </div>
                  <ListRowActions
                    onEdit={() => openEdit(item)}
                    onDelete={() => removeStudent(item)}
                    editLabel="Edit student"
                    deleteLabel="Delete student"
                  />
                </div>
              );
            })}
            {students.length === 0 && (
              <p className="py-10 text-center text-gray-500">No students found.</p>
            )}
          </div>
        )}
      </div>

      {choiceVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={() => setChoiceVisible(false)} role="presentation">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} role="presentation">
            <h2 className="mb-4 text-center text-lg font-semibold text-gray-900">Add students</h2>
            <button
              type="button"
              onClick={() => {
                setChoiceVisible(false);
                setUploadVisible(true);
              }}
              className="mb-3 w-full rounded-lg py-3 font-black text-white"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              Upload Student List
            </button>
            <button type="button" onClick={openAdd} className="w-full rounded-lg py-3 font-black text-white" style={{ backgroundColor: theme.colors.primaryDark }}>
              Add Student
            </button>
            <button type="button" onClick={() => setChoiceVisible(false)} className="mt-4 w-full font-bold text-gray-500">
              Cancel
            </button>
          </div>
        </div>
      )}

      {uploadVisible && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/55 p-4" onClick={() => setUploadVisible(false)} role="presentation">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} role="presentation">
            <h2 className="mb-2 text-center text-lg font-semibold text-gray-900">Upload student list</h2>
            <p className="mb-4 text-center text-sm text-gray-500">
              Upload inside the section you opened. The <strong>Section</strong> column in the file is ignored — students are added to {currentSectionName || "this section"}.
            </p>

            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-gray-600">Supported columns</p>
              <p className="mt-1 text-xs text-gray-500">
                <strong>StuName</strong> (or Full Name), <strong>Reg_no</strong> (or ARID / Ardi Number), and <strong>Email</strong> (optional)
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[320px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-1.5 pr-2 font-semibold text-gray-700">Section</th>
                      <th className="py-1.5 pr-2 font-semibold text-gray-700">StuName</th>
                      <th className="py-1.5 pr-2 font-semibold text-gray-700">Reg_no</th>
                      <th className="py-1.5 font-semibold text-gray-700">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STUDENT_IMPORT_SAMPLE_ROWS.map((row) => (
                      <tr key={row.Reg_no} className="border-b border-gray-100 last:border-b-0">
                        <td className="py-1.5 pr-2 text-gray-600">{row.Section}</td>
                        <td className="py-1.5 pr-2 text-gray-800">{row.StuName}</td>
                        <td className="py-1.5 pr-2 text-gray-800">{row.Reg_no}</td>
                        <td className="py-1.5 text-gray-600">{row.Email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <label className="flex h-12 cursor-pointer items-center rounded-lg bg-gray-100 px-3">
              <input type="file" accept=".xlsx" className="hidden" onChange={pickFile} />
              {selectedFile ? selectedFile.name : "Select .xlsx file"}
            </label>
            <button
              type="button"
              disabled={uploading}
              onClick={uploadStudents}
              className="mt-4 w-full rounded-lg py-3 font-black text-white disabled:opacity-60"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              {uploading ? "…" : "Save"}
            </button>
            <button type="button" onClick={() => setUploadVisible(false)} className="mt-3 w-full font-bold text-gray-500">
              Cancel
            </button>
          </div>
        </div>
      )}

      {formVisible && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/55 p-4" onClick={() => setFormVisible(false)} role="presentation">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} role="presentation">
            <h2 className="mb-4 text-center text-lg font-semibold text-gray-900">
              {editingStudent ? "Edit student" : "Add student"}
            </h2>
            <label className="mb-3 block text-xs font-extrabold text-gray-600">
              Section <span className="text-red-600">*</span>
              <AppSelect
                className="mt-1 w-full"
                value={formSectionId}
                onChange={(e) => setFormSectionId(e.target.value)}
              >
                <option value="">Select section</option>
                {(sessionSections.length ? sessionSections : section ? [section] : []).map((item) => {
                  const id = pickPositiveId(item.sectionId, item.SectionId);
                  return (
                    <option key={id} value={String(id)}>
                      {item.sectionName ?? item.SectionName ?? `Section ${id}`}
                    </option>
                  );
                })}
              </AppSelect>
            </label>
            <label className="mb-3 block text-xs font-extrabold text-gray-600">
              Name <span className="text-red-600">*</span>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 font-normal text-gray-900"
                placeholder="e.g. Ali Khan"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>
            <label className="mb-3 block text-xs font-extrabold text-gray-600">
              ID / Registration <span className="text-red-600">*</span>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 font-normal text-gray-900"
                placeholder="e.g. 23-Arid-0000"
                value={aridNo}
                onChange={(e) => setAridNo(e.target.value)}
              />
            </label>
            <label className="mb-4 block text-xs font-extrabold text-gray-600">
              Email
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 font-normal text-gray-900"
                placeholder="e.g. ali@biit.edu.pk (optional)"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={saveStudent}
              className="w-full rounded-lg py-3 font-black text-white disabled:opacity-60"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              {saving ? "Saving…" : editingStudent ? "Save" : "Add"}
            </button>
            <button type="button" onClick={() => setFormVisible(false)} className="mt-3 w-full font-bold text-gray-500">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SectionAdminStudentsScreen;
