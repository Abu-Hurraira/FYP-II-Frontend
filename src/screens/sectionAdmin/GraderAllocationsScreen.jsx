import React, { useContext, useEffect, useMemo, useState } from "react";
import theme from "../../styles/theme";
import PageBackButton from "../../components/PageBackButton.jsx";
import ListRowActions from "../../components/ListRowActions.jsx";
import { AuthContext } from "../../context/AuthContext.jsx";
import { createUser, deleteUser, getFaculty, getGraderUsers } from "../../api/usersApi";
import { getPrograms } from "../../api/programsApi";
import { getAllRegisteredStudents, getStudentsByProgram } from "../../api/studentsApi";
import { createGraderAllocation, deleteGraderAllocation, getGraderAllocations } from "../../api/graderAllocationsApi";
import {
  buildGraderAridSet,
  buildGraderUserPayload,
  buildStudentLookupMaps,
  filterGradersLinkedToStudents,
  findAllocationForGraderUser,
  getAssignedTeacherName,
  getGradersAssignedToTeacher,
  GRADER_IMPORT_SAMPLE_ROWS,
  isGraderAssignedToTeacher,
  isGraderAssignedToTeacherUser,
  isGraderLinkedToRegisteredStudent,
  isStudentNominatedGrader,
  matchStudentFromImportRow,
  matchesEmailSearch,
  matchesGraderSearch,
  normalizeArid,
  parseExcelRows,
} from "../../utils/graderHelpers";
import { showAlert, showConfirm } from "../../utils/dialogs";

import { GRADER_ROLE_ID } from "../../utils/constants";

function facultyRowsForTeacherPicker(facultyList) {
  return (facultyList || []).filter((u) => {
    const rid = Number(u.roleId);
    const rn = String(u.roleName || "").toLowerCase();
    return rid !== GRADER_ROLE_ID && !rn.includes("grader");
  });
}

const GraderAllocationsScreen = () => {
  const { user } = useContext(AuthContext);

  const [allocations, setAllocations] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [graders, setGraders] = useState([]);
  const [registeredStudents, setRegisteredStudents] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [manualGraderModalVisible, setManualGraderModalVisible] = useState(false);
  const [graderImportModalVisible, setGraderImportModalVisible] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedGraderIds, setSelectedGraderIds] = useState(() => new Set());
  const [teacherSearch, setTeacherSearch] = useState("");
  const [graderSearch, setGraderSearch] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignRefreshing, setAssignRefreshing] = useState(false);

  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [importProgramId, setImportProgramId] = useState("");
  const [programStudents, setProgramStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [aridSearch, setAridSearch] = useState("");
  const [addingStudentKey, setAddingStudentKey] = useState(null);

  const [graderImportFile, setGraderImportFile] = useState(null);
  const [graderImporting, setGraderImporting] = useState(false);

  const graderAridSet = useMemo(() => buildGraderAridSet(graders), [graders]);

  const cleanupOrphanGraderData = async (allGraders, students, allocationData) => {
    const linkedGraders = filterGradersLinkedToStudents(allGraders, students);
    const linkedIds = new Set(linkedGraders.map((grader) => Number(grader.userId)));

    for (const allocation of allocationData || []) {
      if (!linkedIds.has(Number(allocation.graderUserId))) {
        try {
          await deleteGraderAllocation(allocation.graderAllocationId);
        } catch {
          // Best-effort cleanup for stale allocations.
        }
      }
    }

    for (const grader of allGraders || []) {
      if (!linkedIds.has(Number(grader.userId))) {
        try {
          await deleteUser(grader.userId);
        } catch {
          // Best-effort cleanup for grader users without a student record.
        }
      }
    }
  };

  const filterValidAllocations = (allocationData, allGraders, students) => {
    return (allocationData || []).filter((item) => {
      const grader = (allGraders || []).find(
        (user) => Number(user.userId) === Number(item.graderUserId)
      );
      return grader && isGraderLinkedToRegisteredStudent(grader, students);
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [allocationData, facultyRaw, graderData, programData] = await Promise.all([
        getGraderAllocations(),
        getFaculty(),
        getGraderUsers(),
        getPrograms(),
      ]);
      const students = await getAllRegisteredStudents(programData || []);

      await cleanupOrphanGraderData(graderData || [], students, allocationData || []);

      const [freshAllocations, freshGraders] = await Promise.all([
        getGraderAllocations(),
        getGraderUsers(),
      ]);
      const validGraders = filterGradersLinkedToStudents(freshGraders || [], students);

      setRegisteredStudents(students);
      setAllocations(filterValidAllocations(freshAllocations, freshGraders, students));
      setTeachers(facultyRowsForTeacherPicker(facultyRaw));
      setGraders(validGraders);
      setPrograms(programData || []);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadProgramStudents = async (programId) => {
    if (!programId) {
      setProgramStudents([]);
      return;
    }
    try {
      setStudentsLoading(true);
      const data = await getStudentsByProgram(programId);
      setProgramStudents(data || []);
    } catch (error) {
      showAlert("Error", error.message);
      setProgramStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    if (manualGraderModalVisible && selectedProgramId) {
      loadProgramStudents(selectedProgramId);
    }
  }, [manualGraderModalVisible, selectedProgramId]);

  const filteredStudents = useMemo(() => {
    const query = normalizeArid(aridSearch);
    if (!query) return programStudents;
    return programStudents.filter((student) => normalizeArid(student.aridNo).includes(query));
  }, [programStudents, aridSearch]);

  const filteredTeachers = useMemo(() => {
    return teachers.filter((item) => matchesEmailSearch(item, teacherSearch));
  }, [teachers, teacherSearch]);

  const filteredGraders = useMemo(() => {
    return graders.filter((item) => matchesGraderSearch(item, graderSearch));
  }, [graders, graderSearch]);

  const selectableGradersForTeacher = useMemo(() => {
    if (!selectedTeacher?.userId) return [];
    return graders.filter(
      (grader) =>
        isGraderLinkedToRegisteredStudent(grader, registeredStudents) &&
        !isGraderAssignedToTeacher(grader.userId, allocations) // exclude graders already assigned to ANY teacher
    );
  }, [graders, allocations, selectedTeacher, registeredStudents]);

  const filteredSelectableGraders = useMemo(() => {
    return selectableGradersForTeacher.filter((item) => matchesGraderSearch(item, graderSearch));
  }, [selectableGradersForTeacher, graderSearch]);

  const assignedToSelectedTeacher = useMemo(() => {
    if (!selectedTeacher?.userId) return [];
    return getGradersAssignedToTeacher(selectedTeacher.userId, allocations);
  }, [selectedTeacher, allocations]);

  const refreshAssignData = async () => {
    try {
      setAssignRefreshing(true);
      const [allocationData, facultyRaw, graderData] = await Promise.all([
        getGraderAllocations(),
        getFaculty(),
        getGraderUsers(),
      ]);
      const students = await getAllRegisteredStudents(programs);
      await cleanupOrphanGraderData(graderData || [], students, allocationData || []);

      const [freshAllocations, freshGraders] = await Promise.all([
        getGraderAllocations(),
        getGraderUsers(),
      ]);
      const validGraders = filterGradersLinkedToStudents(freshGraders || [], students);

      const validAllocationList = filterValidAllocations(freshAllocations, freshGraders, students);

      setRegisteredStudents(students);
      setAllocations(validAllocationList);
      setTeachers(facultyRowsForTeacherPicker(facultyRaw));
      setGraders(validGraders);
      return { students, validGraders, allocations: validAllocationList };
    } catch (error) {
      showAlert("Error", error.message);
      return { students: [], validGraders: [], allocations: [] };
    } finally {
      setAssignRefreshing(false);
    }
  };

  const openAssignModal = async () => {
    if (programs.length === 0) {
      showAlert("No programs", "Create a program and add students in a section before assigning graders.");
      return;
    }

    setSelectedTeacher(null);
    setSelectedGraderIds(new Set());
    setTeacherSearch("");
    setGraderSearch("");
    setModalVisible(true);

    const { students, validGraders, allocations: freshAllocations } = await refreshAssignData();

    if (students.length === 0) {
      showAlert(
        "No students",
        "Add students first via Programs → Sessions → Sections → Students, then nominate them as graders."
      );
    } else if (validGraders.length === 0) {
      showAlert(
        "No graders",
        "Nominate at least one registered student as a grader before assigning to a teacher."
      );
    }
  };

  const toggleGraderSelection = (grader) => {
    const id = Number(grader.userId);
    if (!selectedTeacher) {
      showAlert("Select teacher", "Choose a teacher first, then select graders.");
      return;
    }
    if (isGraderAssignedToTeacherUser(id, selectedTeacher.userId, allocations)) return;

    setSelectedGraderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectTeacher = (teacher) => {
    setSelectedTeacher(teacher);
    setSelectedGraderIds(new Set());
    setGraderSearch("");
  };

  const saveAllocation = async () => {
    if (!selectedTeacher) {
      showAlert("Validation Error", "Please select a teacher.");
      return;
    }
    if (selectedGraderIds.size === 0) {
      showAlert("Validation Error", "Please select at least one grader.");
      return;
    }
    if (registeredStudents.length === 0) {
      showAlert("Validation Error", "No registered students found. Add students in a section first.");
      return;
    }

    const selectedGraders = graders.filter((g) => selectedGraderIds.has(Number(g.userId)));
    const invalid = selectedGraders.filter(
      (g) => !isGraderLinkedToRegisteredStudent(g, registeredStudents)
    );
    if (invalid.length > 0) {
      showAlert("Validation Error", "Only students nominated from a section can be assigned as graders.");
      return;
    }

    const alreadyAssigned = selectedGraders.filter((g) =>
      isGraderAssignedToTeacherUser(g.userId, selectedTeacher.userId, allocations)
    );
    if (alreadyAssigned.length > 0) {
      showAlert("Validation Error", "One or more selected graders are already assigned to this teacher.");
      return;
    }

    const assignedElsewhere = selectedGraders
      .map((g) => ({ grader: g, allocation: findAllocationForGraderUser(g.userId, allocations) }))
      .filter(({ allocation }) => allocation && Number(allocation.teacherUserId) !== Number(selectedTeacher.userId));

    if (assignedElsewhere.length > 0) {
      const names = assignedElsewhere
        .map(({ grader, allocation }) => `${grader.fullName} → ${getAssignedTeacherName(allocation)}`)
        .join("\n");
      showAlert(
        "Validation Error",
        `These graders are already assigned to another teacher:\n${names}`
      );
      return;
    }

    try {
      setAssignSaving(true);
      const results = await Promise.allSettled(
        selectedGraders.map((grader) =>
          createGraderAllocation({
            teacherUserId: selectedTeacher.userId,
            graderUserId: grader.userId,
          })
        )
      );

      const failed = results.filter((r) => r.status === "rejected");
      const succeeded = results.filter((r) => r.status === "fulfilled").length;

      setSelectedGraderIds(new Set());
      setGraderSearch("");
      await refreshAssignData();

      if (failed.length === 0) {
        showAlert(
          "Success",
          succeeded === 1 ? "Grader assigned to teacher." : `${succeeded} graders assigned to teacher.`
        );
      } else if (succeeded > 0) {
        showAlert(
          "Partial success",
          `${succeeded} assigned. ${failed.length} failed:\n${failed
            .map((r) => r.reason?.message || "Unknown error")
            .slice(0, 5)
            .join("\n")}`
        );
      } else {
        showAlert("Error", failed[0]?.reason?.message || "Failed to assign graders.");
      }
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setAssignSaving(false);
    }
  };

  const removeAllocation = async (item) => {
    if (!(await showConfirm("Remove Allocation", "Remove this grader allocation?"))) return;
    try {
      await deleteGraderAllocation(item.graderAllocationId);
      await loadData();
      if (modalVisible) await refreshAssignData();
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const closeAssignModal = () => {
    setModalVisible(false);
    setSelectedTeacher(null);
    setSelectedGraderIds(new Set());
    setTeacherSearch("");
    setGraderSearch("");
  };

  const openManualGraderModal = () => {
    setAridSearch("");
    setSelectedProgramId(programs[0]?.programId ? String(programs[0].programId) : "");
    setManualGraderModalVisible(true);
  };

  const openGraderImportModal = () => {
    setGraderImportFile(null);
    setImportProgramId(programs[0]?.programId ? String(programs[0].programId) : "");
    setGraderImportModalVisible(true);
  };

  const nominateStudentAsGrader = async (student) => {
    const key = normalizeArid(student.aridNo);
    if (!key || isStudentNominatedGrader(student, graderAridSet)) return;

    try {
      setAddingStudentKey(key);
      await createUser(buildGraderUserPayload(student));
      await loadData();
      if (modalVisible) await refreshAssignData();
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setAddingStudentKey(null);
    }
  };

  const pickGraderImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name?.toLowerCase().endsWith(".xlsx")) {
      showAlert("Invalid File", "Please select a .xlsx Excel file.");
      return;
    }
    setGraderImportFile(file);
    e.target.value = "";
  };

  const submitGraderImport = async () => {
    if (!importProgramId) {
      showAlert("Validation Error", "Please select a program.");
      return;
    }
    if (!graderImportFile) {
      showAlert("No File", "Please select an Excel file first.");
      return;
    }

    try {
      setGraderImporting(true);
      const students = await getStudentsByProgram(importProgramId);
      if (!students.length) {
        showAlert("No students", "This program has no registered students yet. Add students in a section first.");
        setGraderImporting(false);
        return;
      }
      const { byArid, byEmail } = buildStudentLookupMaps(students);
      const rows = await parseExcelRows(graderImportFile);
      const currentGraderArids = buildGraderAridSet(graders);

      let inserted = 0;
      let skipped = 0;
      const errors = [];

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const hasValues = Object.values(row).some((v) => String(v ?? "").trim());
        if (!hasValues) continue;

        const student = matchStudentFromImportRow(row, byArid, byEmail);
        if (!student) {
          errors.push(`Row ${i + 2}: not a registered student in this program.`);
          continue;
        }

        if (isStudentNominatedGrader(student, currentGraderArids)) {
          skipped += 1;
          continue;
        }

        try {
          await createUser(buildGraderUserPayload(student));
          currentGraderArids.add(normalizeArid(student.aridNo));
          inserted += 1;
        } catch (error) {
          errors.push(`Row ${i + 2} (${student.aridNo}): ${error.message}`);
        }
      }

      const errorPreview =
        errors.length > 0
          ? `\n\nErrors:\n${errors.slice(0, 8).join("\n")}${errors.length > 8 ? "\n..." : ""}`
          : "";

      showAlert(
        "Import completed",
        `Added as grader: ${inserted}\nSkipped (already grader): ${skipped}\nInvalid rows: ${errors.length}${errorPreview}`
      );

      setGraderImportModalVisible(false);
      setGraderImportFile(null);
      await loadData();
      if (modalVisible) await refreshAssignData();
    } catch (error) {
      showAlert("Upload Error", error.message);
    } finally {
      setGraderImporting(false);
    }
  };

  const [listSearch, setListSearch] = useState("");

  const filteredAllocations = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return allocations;
    return allocations.filter(
      (item) =>
        String(item.teacherName ?? "").toLowerCase().includes(q) ||
        String(item.teacherEmail ?? "").toLowerCase().includes(q) ||
        String(item.graderName ?? "").toLowerCase().includes(q) ||
        String(item.graderAridNo ?? "").toLowerCase().includes(q) ||
        String(item.graderEmail ?? "").toLowerCase().includes(q)
    );
  }, [allocations, listSearch]);

  /** Returns 1–2 capital initials from a full name */
  function getInitials(name) {
    const parts = String(name || "").trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return "?";
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  return (
    <div className="min-h-full w-full bg-page p-4 sm:p-6 lg:p-8">
      {/* ── Main Container Box (Full Width Across Page) ── */}
      <div
        className="w-full rounded-3xl border p-5 shadow-2xl sm:p-6"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        {/* Header Top Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3.5">
            <PageBackButton />
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
              style={{ backgroundColor: "var(--brand-dark)" }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
                All Graders
              </h1>
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                View and manage all registered graders in the system
              </p>
            </div>
          </div>

          {/* Right side Controls: Search bar + Filter icon */}
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center gap-2 rounded-xl border px-3.5 py-2"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--text-muted)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                className="w-48 bg-transparent text-sm outline-none sm:w-72"
                style={{ color: "var(--text)" }}
                placeholder="Search graders..."
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
              />
            </div>

            {/* Filter button */}
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm transition hover:opacity-90"
              style={{ backgroundColor: "var(--brand)" }}
              title="Clear search"
              onClick={() => setListSearch("")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M8 12h8M11 20h2" />
              </svg>
            </button>
          </div>
        </div>

        {/* Action buttons strip */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4">
          <button type="button" onClick={openAssignModal} className="app-btn-primary rounded-xl px-4 py-2 text-xs font-bold shadow-sm">
            + Assign to teacher
          </button>
          <button type="button" onClick={openManualGraderModal} className="app-btn-primary rounded-xl px-4 py-2 text-xs font-bold shadow-sm">
            + Add grader (manual)
          </button>
          <button type="button" onClick={openGraderImportModal} className="app-btn-primary rounded-xl px-4 py-2 text-xs font-bold shadow-sm">
            + Add grader (file)
          </button>
        </div>

        {/* ── Cards List ── */}
        <div className="mt-4">
          {loading ? (
            <div className="flex justify-center py-20">
              <div
                className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
                style={{ borderTopColor: theme.colors.primary }}
              />
            </div>
          ) : filteredAllocations.length === 0 ? (
            <div
              className="my-6 rounded-2xl border border-dashed px-6 py-14 text-center"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
            >
              <svg className="mx-auto mb-3 h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--text-muted)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2h5M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
              </svg>
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
                {listSearch ? "No graders match your search." : "No grader allocations found."}
              </p>
              {!listSearch && (
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  Use "Assign to teacher" to create grader allocations.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {filteredAllocations.map((item) => (
                <div
                  key={item.graderAllocationId}
                  className="flex items-center justify-between gap-6 rounded-2xl border p-4 shadow-lg transition-all hover:bg-emerald-500/5"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    borderColor: "var(--border)",
                    borderLeftColor: "var(--brand)",
                    borderLeftWidth: "4px",
                  }}
                >
                  {/* Avatar Icon */}
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                    style={{ backgroundColor: "var(--brand-dark)" }}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>

                  {/* Teacher name + role badge */}
                  <div className="w-40 shrink-0">
                    <p className="truncate text-sm font-bold" style={{ color: "var(--text)" }}>
                      {item.teacherName}
                    </p>
                    <span
                      className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                      style={{
                        backgroundColor: "var(--brand-muted)",
                        color: "var(--brand)",
                        border: "1px solid var(--brand-soft)",
                      }}
                    >
                      Teacher
                    </span>
                  </div>

                  {/* Email Column */}
                  <div className="hidden min-w-0 flex-1 sm:flex sm:items-center sm:gap-2.5">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                      style={{ backgroundColor: "var(--brand-muted)", borderColor: "var(--brand-soft)", color: "var(--brand)" }}
                    >
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        EMAIL
                      </p>
                      <p className="truncate text-xs font-semibold" style={{ color: "var(--text)" }}>
                        {item.teacherEmail}
                      </p>
                    </div>
                  </div>

                  {/* Grader Name Column */}
                  <div className="hidden min-w-0 flex-1 sm:flex sm:items-center sm:gap-2.5">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                      style={{ backgroundColor: "var(--brand-muted)", borderColor: "var(--brand-soft)", color: "var(--brand)" }}
                    >
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zm-4 7a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        GRADER
                      </p>
                      <p className="truncate text-xs font-semibold" style={{ color: "var(--text)" }}>
                        {item.graderName}
                      </p>
                    </div>
                  </div>

                  {/* ARID Number Column */}
                  {item.graderAridNo ? (
                    <div className="hidden min-w-0 flex-1 sm:flex sm:items-center sm:gap-2.5">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                        style={{ backgroundColor: "var(--brand-muted)", borderColor: "var(--brand-soft)", color: "var(--brand)" }}
                      >
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-5m-4 0V5a2 2 0 0 1 4 0v1m-4 0h4" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          ARID NUMBER
                        </p>
                        <p className="truncate text-xs font-semibold" style={{ color: "var(--text)" }}>
                          {item.graderAridNo}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="hidden flex-1 sm:block" />
                  )}

                  {/* Mobile Compact Details */}
                  <div className="min-w-0 flex-1 sm:hidden">
                    <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>{item.teacherEmail}</p>
                    <p className="mt-1 truncate text-xs font-semibold" style={{ color: "var(--text)" }}>
                      Grader: {item.graderName}
                    </p>
                    {item.graderAridNo && (
                      <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>{item.graderAridNo}</p>
                    )}
                  </div>

                  {/* Trash Delete Action */}
                  <button
                    type="button"
                    onClick={() => removeAllocation(item)}
                    className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-red-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    title="Remove allocation"
                  >
                    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={closeAssignModal} role="presentation">
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl shadow-xl"
            style={{ backgroundColor: "var(--surface)" }}
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <div className="border-b px-6 py-4" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-center text-lg font-semibold" style={{ color: "var(--text)" }}>Assign grader to teacher</h2>
              <p className="mt-1 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                Select a teacher, then choose one or more graders not already assigned to them.
              </p>
              {assignRefreshing ? (
                <p className="mt-1 text-center text-xs text-gray-500">Refreshing teachers and graders…</p>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div>
                <label className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Search teacher by email</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  placeholder="e.g. mohsin@biit.edu.pk"
                />
                <div
                  className="mt-2 max-h-36 overflow-y-auto rounded-lg border"
                  style={{ borderColor: "var(--border)" }}
                >
                  {filteredTeachers.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>No teachers match your search.</p>
                  ) : (
                    filteredTeachers.map((item) => {
                      const selected = selectedTeacher?.userId === item.userId;
                      return (
                        <button
                          key={String(item.userId)}
                          type="button"
                          onClick={() => selectTeacher(item)}
                          className={`block w-full border-b px-3 py-2.5 text-left last:border-b-0`}
                          style={{
                            borderBottomColor: "var(--border)",
                            backgroundColor: selected ? "var(--brand-muted)" : "transparent",
                          }}
                          onMouseEnter={(e) => { if (!selected) e.currentTarget.style.backgroundColor = "var(--surface-2)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = selected ? "var(--brand-muted)" : "transparent"; }}
                        >
                          <span className="block text-sm font-semibold" style={{ color: "var(--text)" }}>{item.fullName}</span>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{item.email}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-extrabold" style={{ color: "var(--text)" }}>
                  Select graders
                  {selectedTeacher ? (
                    <span className="ml-1 font-normal text-gray-500">
                      ({selectedGraderIds.size} selected
                      {assignedToSelectedTeacher.length > 0
                        ? ` · ${assignedToSelectedTeacher.length} already on this teacher`
                        : ""}
                      )
                    </span>
                  ) : null}
                </label>
                {!selectedTeacher ? (
                  <p className="mt-2 rounded-lg border border-dashed px-3 py-4 text-center text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                    Select a teacher above to choose graders.
                  </p>
                ) : (
                  <>
                    <input
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                      value={graderSearch}
                      onChange={(e) => setGraderSearch(e.target.value)}
                      placeholder="e.g. aliislam@gmail.com or 23-ARID-0123"
                    />
                    <div
                      className="mt-2 max-h-48 overflow-y-auto rounded-lg border"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {graders.length === 0 ? (
                        <p className="px-3 py-4 text-center text-xs text-gray-500">
                          No student graders yet. Nominate students first using Add grader (manual) or (file).
                        </p>
                      ) : filteredGraders.length === 0 && filteredSelectableGraders.length === 0 ? (
                        <p className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                          {selectableGradersForTeacher.length === 0
                            ? "All graders are already assigned to this teacher."
                            : "No graders match your search."}
                        </p>
                      ) : (
                        <>
                          {filteredGraders
                            .filter((item) =>
                              isGraderAssignedToTeacherUser(item.userId, selectedTeacher.userId, allocations)
                            )
                            .map((item) => (
                              <div
                                key={`assigned-${item.userId}`}
                                className="flex items-start gap-3 border-b px-3 py-2.5 last:border-b-0"
                                style={{ backgroundColor: "var(--surface-2)", borderBottomColor: "var(--border)" }}
                              >
                                <input
                                  type="checkbox"
                                  className="mt-1 h-4 w-4 shrink-0 accent-green-700"
                                  checked
                                  disabled
                                  readOnly
                                />
                                <div className="min-w-0">
                                  <span className="block text-sm font-semibold" style={{ color: "var(--text-muted)" }}>{item.fullName}</span>
                                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{item.email}</span>
                                  {item.aridNo ? (
                                    <span className="block text-xs" style={{ color: "var(--text-muted)" }}>{item.aridNo}</span>
                                  ) : null}
                                  <span className="mt-1 block text-xs font-medium text-brand">
                                    Already assigned to this teacher
                                  </span>
                                </div>
                              </div>
                            ))}

                          {filteredGraders
                            .filter((item) => {
                              const onThisTeacher = isGraderAssignedToTeacherUser(
                                item.userId,
                                selectedTeacher.userId,
                                allocations
                              );
                              if (onThisTeacher) return false;
                              const other = findAllocationForGraderUser(item.userId, allocations);
                              return !!other;
                            })
                            .map((item) => {
                              const existingAllocation = findAllocationForGraderUser(item.userId, allocations);
                              return (
                                <div
                                  key={`other-${item.userId}`}
                                  className="flex items-start gap-3 border-b px-3 py-2.5 last:border-b-0"
                                  style={{ backgroundColor: "var(--surface-2)", borderBottomColor: "var(--border)" }}
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-1 h-4 w-4 shrink-0"
                                    disabled
                                    readOnly
                                  />
                                  <div className="min-w-0">
                                    <span className="block text-sm font-semibold" style={{ color: "var(--text-muted)" }}>{item.fullName}</span>
                                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{item.email}</span>
                                    {item.aridNo ? (
                                      <span className="block text-xs" style={{ color: "var(--text-muted)" }}>{item.aridNo}</span>
                                    ) : null}
                                    <span className="mt-1 block text-xs font-semibold" style={{ color: "#f59e0b" }}>
                                      Already assigned to {getAssignedTeacherName(existingAllocation)} — cannot reassign
                                    </span>
                                  </div>
                                </div>
                              );
                            })}

                          {filteredSelectableGraders.map((item) => {
                            const checked = selectedGraderIds.has(Number(item.userId));
                            return (
                              <label
                                key={String(item.userId)}
                                className="flex cursor-pointer items-start gap-3 border-b px-3 py-2.5 last:border-b-0"
                                style={{
                                  borderBottomColor: "var(--border)",
                                  backgroundColor: checked ? "var(--brand-muted)" : "transparent",
                                }}
                                onMouseEnter={(e) => { if (!checked) e.currentTarget.style.backgroundColor = "var(--surface-2)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = checked ? "var(--brand-muted)" : "transparent"; }}
                              >
                                <input
                                  type="checkbox"
                                  className="mt-1 h-4 w-4 shrink-0 accent-green-700"
                                  checked={checked}
                                  onChange={() => toggleGraderSelection(item)}
                                />
                                <div className="min-w-0">
                                  <span className="block text-sm font-semibold" style={{ color: "var(--text)" }}>{item.fullName}</span>
                                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{item.email}</span>
                                  {item.aridNo ? (
                                    <span className="block text-xs" style={{ color: "var(--text-muted)" }}>{item.aridNo}</span>
                                  ) : null}
                                </div>
                              </label>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="border-t px-6 py-4" style={{ borderColor: "var(--border)" }}>
              <button
                type="button"
                disabled={
                  assignSaving ||
                  assignRefreshing ||
                  !selectedTeacher ||
                  selectedGraderIds.size === 0 ||
                  registeredStudents.length === 0
                }
                onClick={saveAllocation}
                className="w-full rounded-lg py-3 font-black text-white disabled:opacity-60"
                style={{ backgroundColor: theme.colors.primaryDark }}
              >
                {assignSaving
                  ? "Assigning…"
                  : selectedGraderIds.size > 1
                    ? `Assign ${selectedGraderIds.size} Graders`
                    : "Assign Grader"}
              </button>
              <button type="button" onClick={closeAssignModal} className="mt-3 w-full font-bold text-gray-500">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {manualGraderModalVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setManualGraderModalVisible(false)}
          role="presentation"
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl shadow-xl"
            style={{ backgroundColor: "var(--surface)" }}
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <div className="relative border-b px-6 py-4" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-center text-lg font-semibold" style={{ color: "var(--text)" }}>Nominate student as grader</h2>
              <p className="mt-1 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                Select students from a program. Checked students are added to Users with the Grader role.
              </p>
              <button
                type="button"
                className="absolute right-4 top-3 text-2xl text-gray-500"
                onClick={() => setManualGraderModalVisible(false)}
              >
                ×
              </button>
            </div>

            <div className="space-y-3 border-b px-6 py-4" style={{ borderColor: "var(--border)" }}>
              <label className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Program</label>
              <select
                className="w-full rounded-lg border px-3 py-2"
                style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
              >
                <option value="">Select program</option>
                {programs.map((program) => (
                  <option key={program.programId} value={String(program.programId)}>
                    {program.programName}
                  </option>
                ))}
              </select>

              <label className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Search by ARID (XX-ARID-XXXX)</label>
              <input
                className="w-full rounded-lg border px-3 py-2"
                style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                value={aridSearch}
                onChange={(e) => setAridSearch(e.target.value)}
                placeholder="e.g. 24-ARID-1234"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
              {studentsLoading ? (
                <div className="flex justify-center py-10">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-transparent" style={{ borderTopColor: theme.colors.primary }} />
                </div>
              ) : !selectedProgramId ? (
                <p className="py-8 text-center text-sm text-gray-500">Choose a program to load students.</p>
              ) : programStudents.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  No students in this program yet. Add students in a section first (Programs → Sessions → Sections → Students).
                </p>
              ) : filteredStudents.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">No students match your search.</p>
              ) : (
                <ul className="space-y-2">
                   {filteredStudents.map((student) => {
                    const nominated = isStudentNominatedGrader(student, graderAridSet);
                    const key = normalizeArid(student.aridNo);
                    const busy = addingStudentKey === key;

                    return (
                      <li
                        key={`${student.studentId}-${key}`}
                        className={`flex items-start gap-3 rounded-lg border p-3 ${
                          nominated
                            ? "border-green-300 dark-grader-nominated"
                            : "border-gray-200 bg-white"
                        }`}
                        style={nominated ? { backgroundColor: "var(--brand-muted)", borderColor: "var(--brand-soft)" } : {}}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 shrink-0 accent-green-700"
                          checked={nominated}
                          disabled={nominated || busy}
                          onChange={() => nominateStudentAsGrader(student)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className="text-sm font-semibold"
                              style={{ color: "var(--text)" }}
                            >
                              {student.fullName}
                            </p>
                            {nominated ? (
                              <span
                                className="rounded-full px-2 py-0.5 text-xs font-semibold"
                                style={{
                                  backgroundColor: "var(--brand-dark)",
                                  color: "#ffffff",
                                }}
                              >
                                Grader
                              </span>
                            ) : null}
                            {busy ? (
                              <span style={{ color: "var(--text-muted)" }} className="text-xs">
                                Adding…
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-xs font-medium" style={{ color: "var(--text)" }}>
                            {student.aridNo}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {student.sectionName ? `Section: ${student.sectionName}` : null}
                            {student.email ? ` · ${student.email}` : null}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-gray-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setManualGraderModalVisible(false)}
                className="w-full font-bold text-gray-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {graderImportModalVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setGraderImportModalVisible(false)}
          role="presentation"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} role="presentation">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Add grader (Excel)</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Upload a .xlsx file with student ARIDs from the selected program. Each valid row creates a grader user.
                </p>
              </div>
              <button type="button" onClick={() => setGraderImportModalVisible(false)} className="text-2xl text-gray-500">
                ×
              </button>
            </div>

            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-gray-600">Sample file format</p>
              <p className="mt-1 text-xs text-gray-500">Use column headers <strong>ARID</strong> and/or <strong>Email</strong>:</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[240px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-1.5 pr-3 font-semibold text-gray-700">ARID</th>
                      <th className="py-1.5 font-semibold text-gray-700">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {GRADER_IMPORT_SAMPLE_ROWS.map((row) => (
                      <tr key={row.ARID} className="border-b border-gray-100 last:border-b-0">
                        <td className="py-1.5 pr-3 text-gray-800">{row.ARID}</td>
                        <td className="py-1.5 text-gray-600">{row.Email || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Email is optional if ARID matches a student. Rows that are not registered students in the program are skipped.
              </p>
            </div>

            <label className="text-sm font-extrabold">Program</label>
            <select
              className="mb-3 mt-1 w-full rounded-lg border bg-white px-3 py-2"
              value={importProgramId}
              onChange={(e) => setImportProgramId(e.target.value)}
            >
              <option value="">Select program</option>
              {programs.map((program) => (
                <option key={program.programId} value={String(program.programId)}>
                  {program.programName}
                </option>
              ))}
            </select>

            <label className="flex h-12 cursor-pointer items-center rounded-lg bg-gray-100 px-3 text-gray-600">
              <input type="file" accept=".xlsx" className="hidden" onChange={pickGraderImportFile} />
              {graderImportFile ? graderImportFile.name : "Select .xlsx file (ARID or email column)"}
            </label>
            <button
              type="button"
              disabled={graderImporting}
              onClick={submitGraderImport}
              className="mt-4 w-full rounded-lg py-3 font-extrabold text-white disabled:opacity-60"
              style={{ backgroundColor: theme.colors.primaryDark }}
            >
              {graderImporting ? "Importing…" : "Import graders"}
            </button>
            <button type="button" onClick={() => setGraderImportModalVisible(false)} className="mt-3 w-full font-bold text-gray-500">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GraderAllocationsScreen;
