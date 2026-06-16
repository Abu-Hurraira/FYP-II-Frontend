import React, { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import theme from "../../styles/theme";
import { AuthContext } from "../../context/AuthContext.jsx";
import {
  createStudent,
  deleteStudent,
  getStudentsBySection,
  updateStudent,
} from "../../api/studentsApi";
import {
  importStudentsFromExcelFile,
  STUDENT_IMPORT_SAMPLE_ROWS,
} from "../../utils/studentImportHelpers";
import { deleteUser, getGraderUsers } from "../../api/usersApi";
import { deleteGraderAllocation, getGraderAllocations } from "../../api/graderAllocationsApi";
import { filterGradersLinkedToStudents, findGraderAllocationForStudent, findGraderUserForStudent, getAssignedTeacherName } from "../../utils/graderHelpers";
import PageBackButton from "../../components/PageBackButton.jsx";
import AddHeaderButton from "../../components/AddHeaderButton.jsx";
import ListRowActions from "../../components/ListRowActions.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";

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
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const loadStudents = async () => {
    if (!section?.sectionId) return;
    try {
      setLoading(true);
      const [data, graderData, allocationData] = await Promise.all([
        getStudentsBySection(section.sectionId),
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

  useEffect(() => {
    loadStudents();
  }, [section?.sectionId]);

  const resetForm = () => {
    setEditingStudent(null);
    setFullName("");
    setAridNo("");
    setEmail("");
  };

  const openAdd = () => {
    resetForm();
    setChoiceVisible(false);
    setFormVisible(true);
  };

  const openEdit = (item) => {
    setEditingStudent(item);
    setFullName(item.fullName);
    setAridNo(item.aridNo);
    setEmail(item.email || "");
    setFormVisible(true);
  };

  const saveStudent = async () => {
    if (!fullName.trim()) {
      showAlert("Validation Error", "Student name is required.");
      return;
    }
    if (!aridNo.trim()) {
      showAlert("Validation Error", "ARID / Roll number is required.");
      return;
    }
    try {
      if (editingStudent) {
        await updateStudent(editingStudent.studentId, {
          fullName: fullName.trim(),
          aridNo: aridNo.trim(),
          email: email.trim() || null,
        });
      } else {
        await createStudent({
          sectionId: section.sectionId,
          fullName: fullName.trim(),
          aridNo: aridNo.trim(),
          email: email.trim() || null,
        });
      }
      setFormVisible(false);
      resetForm();
      await loadStudents();
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const removeStudent = async (student) => {
    const graderUser = findGraderUserForStudent(student, graders);
    const confirmMessage = graderUser
      ? `Delete ${student.fullName}? Their grader user account will also be removed.`
      : `Delete ${student.fullName}?`;

    if (!(await showConfirm("Delete Student", confirmMessage))) return;

    try {
      if (graderUser?.userId) {
        const allocations = await getGraderAllocations();
        const related = (allocations || []).filter(
          (item) => Number(item.graderUserId) === Number(graderUser.userId)
        );
        for (const allocation of related) {
          await deleteGraderAllocation(allocation.graderAllocationId);
        }
        await deleteUser(graderUser.userId);
      }

      await deleteStudent(student.studentId);
      if (editingStudent?.studentId === student.studentId) {
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
      const result = await importStudentsFromExcelFile(section.sectionId, selectedFile);
      const errorPreview =
        result.errors && result.errors.length > 0
          ? `\n\nErrors:\n${result.errors.slice(0, 5).join("\n")}${result.errors.length > 5 ? "\n..." : ""}`
          : "";
      showAlert(
        "Import Completed",
        `Inserted: ${result.insertedCount || 0}
Skipped: ${result.skippedCount || 0}
Errors: ${result.errorCount || 0}${errorPreview}`
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
          <h1 className="truncate text-xl font-semibold text-gray-900">{section.sectionName}</h1>
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
              const nominatedGrader = !!findGraderUserForStudent(item, graders);
              const graderAllocation = findGraderAllocationForStudent(item, graders, allocations);
              const assignedTeacher = getAssignedTeacherName(graderAllocation);
              return (
              <div
                key={item.studentId}
                className={`flex items-start gap-3 rounded-lg border p-4 shadow-sm ${
                  nominatedGrader ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{item.fullName}</p>
                    {nominatedGrader ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                        Grader
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-gray-600">{item.aridNo}</p>
                  {item.email ? <p className="mt-0.5 text-xs text-gray-500">{item.email}</p> : null}
                  {nominatedGrader && assignedTeacher ? (
                    <p className="mt-1 text-xs font-semibold text-green-800">
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
              Upload inside the section you opened. The <strong>Section</strong> column in the file is ignored — students are added to {section.sectionName}.
            </p>

            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-gray-600">Supported columns</p>
              <p className="mt-1 text-xs text-gray-500">
                <strong>Full Name</strong>, <strong>Ardi Number</strong> / ARID, and <strong>Email</strong> (optional)
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[320px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-1.5 pr-2 font-semibold text-gray-700">Section</th>
                      <th className="py-1.5 pr-2 font-semibold text-gray-700">Full Name</th>
                      <th className="py-1.5 pr-2 font-semibold text-gray-700">Ardi Number</th>
                      <th className="py-1.5 font-semibold text-gray-700">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STUDENT_IMPORT_SAMPLE_ROWS.map((row) => (
                      <tr key={row["Ardi Number"]} className="border-b border-gray-100 last:border-b-0">
                        <td className="py-1.5 pr-2 text-gray-600">{row.Section}</td>
                        <td className="py-1.5 pr-2 text-gray-800">{row["Full Name"]}</td>
                        <td className="py-1.5 pr-2 text-gray-800">{row["Ardi Number"]}</td>
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
            <input className="mb-3 w-full rounded-lg border px-3 py-2" placeholder="Student name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <input className="mb-3 w-full rounded-lg border px-3 py-2" placeholder="ARID / Roll No" value={aridNo} onChange={(e) => setAridNo(e.target.value)} />
            <input
              className="mb-4 w-full rounded-lg border px-3 py-2"
              placeholder="Email optional"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="button" onClick={saveStudent} className="w-full rounded-lg py-3 font-black text-white" style={{ backgroundColor: theme.colors.primaryDark }}>
              {editingStudent ? "Save" : "Add"}
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
