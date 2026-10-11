import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import theme from "../../styles/theme";
import { AuthContext } from "../../context/AuthContext.jsx";
import { createUser, deleteUser, getFaculty, importFacultyFromExcel, updateUser } from "../../api/usersApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import AddHeaderButton from "../../components/AddHeaderButton.jsx";
import ListRowActions from "../../components/ListRowActions.jsx";
import AppSelect from "../../components/AppSelect.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";
import { ROLE_IDS } from "../../utils/constants";

const FACULTY_ROLES = [
  { roleId: ROLE_IDS.TEACHER, label: "Teacher" },
  { roleId: ROLE_IDS.HOD, label: "HOD" },
];

function facultyRoleId(item) {
  const id = Number(item?.roleId ?? item?.RoleId);
  return id === ROLE_IDS.HOD ? ROLE_IDS.HOD : ROLE_IDS.TEACHER;
}

const STANDARD_RANKS = [
  "Lecturer",
  "Assistant Professor",
  "Associate Professor",
  "Professor",
  "HoD",
  "HoD & Assistant Professor",
  "HoD & Associate Professor",
  "HoD Math & Assistant Professor",
  "HoD Software Engineering & Assistant Professor",
  "Deputy Director & HoD CS",
];

const FacultyScreen = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rank, setRank] = useState("");
  const [roleId, setRoleId] = useState(ROLE_IDS.TEACHER);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const loadFaculty = async () => {
    try {
      setLoading(true);
      const data = await getFaculty();
      setFaculty(data || []);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFaculty();
  }, []);

  const rankOptions = useMemo(() => {
    const options = new Set(STANDARD_RANKS);
    faculty.forEach((item) => {
      const value = String(item?.rank || item?.Rank || "").trim();
      if (value) options.add(value);
    });
    if (rank) options.add(rank);
    return Array.from(options);
  }, [faculty, rank]);

  const resetForm = () => {
    setEditingUser(null);
    setFullName("");
    setEmail("");
    setPassword("");
    setRank("");
    setRoleId(ROLE_IDS.TEACHER);
    setSelectedFile(null);
  };

  const openAddModal = () => {
    resetForm();
    setFormVisible(true);
  };

  const openEditModal = (item) => {
    setEditingUser(item);
    setFullName(item.fullName || "");
    setEmail(item.email || "");
    setPassword("");
    setRank(item.rank || item.Rank || "");
    setRoleId(facultyRoleId(item));
    setFormVisible(true);
  };

  const closeFormModal = () => {
    setFormVisible(false);
    resetForm();
  };

  const validateForm = () => {
    if (!fullName.trim()) {
      showAlert("Validation Error", "Full name is required.");
      return false;
    }
    if (!email.trim()) {
      showAlert("Validation Error", "Email is required.");
      return false;
    }
    if (!editingUser && !password.trim()) {
      showAlert("Validation Error", "Password is required.");
      return false;
    }
    if (Number(roleId) !== ROLE_IDS.TEACHER && Number(roleId) !== ROLE_IDS.HOD) {
      showAlert("Validation Error", "Select Teacher or HOD.");
      return false;
    }
    return true;
  };

  const handleSaveUser = async () => {
    if (!validateForm()) return;

    const payload = {
      fullName: fullName.trim(),
      email: email.trim(),
      password: password.trim(),
      roleId: Number(roleId),
      rank: rank.trim() || null,
      aridNo: null,
    };

    try {
      setLoading(true);
      if (editingUser) {
        await updateUser(editingUser.userId, payload);
        showAlert("Success", "Faculty member updated successfully.");
      } else {
        await createUser(payload);
        showAlert("Success", "Faculty member added successfully.");
      }
      closeFormModal();
      await loadFaculty();
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (item) => {
    if (!(await showConfirm("Delete Faculty", `Are you sure you want to delete ${item.fullName}?`))) return;
    try {
      setLoading(true);
      await deleteUser(item.userId);
      showAlert("Success", "Faculty member deleted successfully.");
      await loadFaculty();
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
      const result = await importFacultyFromExcel(selectedFile);
      showAlert(
        "Import Completed",
        `Inserted: ${result.insertedCount ?? result.InsertedCount ?? 0}\nSkipped: ${result.skippedCount ?? result.SkippedCount ?? 0}\nErrors: ${result.errorCount ?? result.ErrorCount ?? 0}`
      );
      setUploadVisible(false);
      setSelectedFile(null);
      setFormVisible(false);
      resetForm();
      await loadFaculty();
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
          <h1 className="truncate text-xl font-semibold text-gray-900">Faculty</h1>
          <p className="mt-0.5 text-xs text-gray-500">{user?.roleName || "Administrator"}</p>
        </div>
        <AddHeaderButton label="Add Faculty" onClick={openAddModal} />
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        {loading && faculty.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent" style={{ borderTopColor: theme.colors.primary }} />
            <p className="mt-3 text-gray-500">Loading faculty...</p>
          </div>
        ) : (
          <div className="space-y-2.5 pb-16">
            {faculty.map((item) => (
              <div key={item.userId} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white shadow-card p-4 shadow-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{item.fullName}</p>
                  <p className="mt-0.5 text-xs text-gray-600">{item.email}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {item.roleName ?? item.RoleName ?? (facultyRoleId(item) === ROLE_IDS.HOD ? "HOD" : "Teacher")}
                    {item.rank || item.Rank ? ` · ${item.rank || item.Rank}` : ""}
                  </p>
                </div>
                <ListRowActions
                  onEdit={() => openEditModal(item)}
                  onDelete={() => handleDeleteUser(item)}
                  editLabel="Edit faculty"
                  deleteLabel="Delete faculty"
                />
              </div>
            ))}
            {faculty.length === 0 && (
              <p className="py-10 text-center text-gray-500">No faculty members added yet.</p>
            )}
          </div>
        )}
      </div>

      {formVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={closeFormModal} role="presentation">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[#f8fafc] p-6 shadow-xl" onClick={(e) => e.stopPropagation()} role="presentation">
            <div className="relative mb-4 text-center">
              <h2 className="text-lg font-semibold text-gray-900">{editingUser ? "Edit" : "Add New Faculty Member"}</h2>
              <button type="button" className="absolute right-0 top-0 text-3xl text-gray-500" onClick={closeFormModal}>
                ×
              </button>
            </div>
            <label className="text-sm font-extrabold">{editingUser ? "Change Name" : "Full Name"}</label>
            <input className="mb-3 mt-1 w-full rounded-lg border bg-white px-3 py-2 placeholder:text-gray-400" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Mohsin Ali" />
            <label className="text-sm font-extrabold">{editingUser ? "Change mail" : "Email"}</label>
            <input className="mb-3 mt-1 w-full rounded-lg border bg-white px-3 py-2 placeholder:text-gray-400" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. mohsin@biit.edu.pk" />
            <label className="text-sm font-extrabold">{editingUser ? "Change password" : "Password"}</label>
            <input className="mb-3 mt-1 w-full rounded-lg border bg-white px-3 py-2 placeholder:text-gray-400" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={editingUser ? "e.g. New password (optional)" : "e.g. Teacher@123"} />
            <label className="text-sm font-extrabold">{editingUser ? "Change Role" : "Role"}</label>
            <AppSelect
              className="mb-3 mt-1 w-full rounded-lg border bg-white px-3 py-2"
              value={String(roleId)}
              onChange={(e) => setRoleId(Number(e.target.value))}
            >
              {FACULTY_ROLES.map((option) => (
                <option key={option.roleId} value={option.roleId}>
                  {option.label}
                </option>
              ))}
            </AppSelect>
            <label className="text-sm font-extrabold">{editingUser ? "Change Rank" : "Rank"}</label>
            <AppSelect
              className="mb-3 mt-1 w-full rounded-lg border bg-white px-3 py-2"
              value={rank}
              onChange={(e) => setRank(e.target.value)}
            >
              <option value="">Select rank</option>
              {rankOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </AppSelect>
            {!editingUser && (
              <button
                type="button"
                onClick={() => setUploadVisible(true)}
                className="app-btn-primary app-btn-primary-block mb-3 w-full py-3 font-extrabold"
              >
                Upload File
              </button>
            )}
            <button type="button" onClick={handleSaveUser} className="app-btn-primary app-btn-primary-block w-full py-3 font-extrabold">
              {editingUser ? "Save" : "Add Teacher"}
            </button>
          </div>
        </div>
      )}

      {uploadVisible && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setUploadVisible(false)} role="presentation">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} role="presentation">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Upload Faculty List</h2>
              <button type="button" onClick={() => setUploadVisible(false)} className="text-3xl text-gray-500">
                ×
              </button>
            </div>
            <label className="flex h-12 cursor-pointer items-center rounded-lg bg-gray-100 px-3 text-gray-600">
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
            <button type="button" onClick={() => setUploadVisible(false)} className="mt-3 w-full rounded-lg py-3 font-extrabold text-white" style={{ backgroundColor: theme.colors.primaryDark }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyScreen;
