import React, { useContext, useEffect, useMemo, useState } from "react";
import theme from "../../styles/theme";
import PageBackButton from "../../components/PageBackButton.jsx";
import AppSelect from "../../components/AppSelect.jsx";
import ListRowActions from "../../components/ListRowActions.jsx";
import GraderBadge from "../../components/GraderBadge.jsx";
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
  findGraderAllocationForStudent,
  findGraderUserForStudent,
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
    return graders.filter(
      (grader) =>
        isGraderLinkedToRegisteredStudent(grader, registeredStudents) &&
        !isGraderAssignedToTeacher(grader.userId, allocations)
    );
  }, [graders, allocations, registeredStudents]);

  const filteredSelectableGraders = useMemo(() => {
    return selectableGradersForTeacher.filter((item) => matchesGraderSearch(item, graderSearch));
  }, [selectableGradersForTeacher, graderSearch]);

  const assignedGradersVisible = useMemo(() => {
    return filteredGraders.filter((item) => isGraderAssignedToTeacher(item.userId, allocations));
  }, [filteredGraders, allocations]);

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
    if (isGraderAssignedToTeacher(id, allocations)) return;

    setSelectedGraderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectTeacher = (teacher) => {
    setSelectedTeacher(teacher);
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

  const unnominateStudentAsGrader = async (student) => {
    const key = normalizeArid(student.aridNo);
    const graderUser = findGraderUserForStudent(student, graders);
    if (!key || !graderUser?.userId) return;

    const allocation = findGraderAllocationForStudent(student, graders, allocations);
    if (allocation) {
      const teacherName = getAssignedTeacherName(allocation) || "a teacher";
      if (
        !(await showConfirm(
          "Remove grader?",
          `${student.fullName} is assigned to ${teacherName}. Unticking will remove the assignment and the Grader badge.`
        ))
      ) {
        return;
      }
    }

    try {
      setAddingStudentKey(key);
      if (allocation?.graderAllocationId ?? allocation?.GraderAllocationId) {
        await deleteGraderAllocation(allocation.graderAllocationId ?? allocation.GraderAllocationId);
      }
      await deleteUser(graderUser.userId);
      await loadData();
      if (modalVisible) await refreshAssignData();
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setAddingStudentKey(null);
    }
  };

  const toggleStudentNomination = (student, nominated) => {
    if (nominated) unnominateStudentAsGrader(student);
    else nominateStudentAsGrader(student);
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

  return (
    <div className="relative min-h-full bg-page">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-gray-900">All Graders</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            {user?.roleName || "SectionAdmin"} · Badge is added only after assignment to a teacher
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={openAssignModal} className="app-btn-primary rounded-lg px-3 py-2 text-xs font-bold">
            Assign to teacher
          </button>
          <button type="button" onClick={openManualGraderModal} className="app-btn-primary rounded-lg px-3 py-2 text-xs font-bold">
            Add grader (manual)
          </button>
          <button type="button" onClick={openGraderImportModal} className="app-btn-primary rounded-lg px-3 py-2 text-xs font-bold">
            Add grader (file)
          </button>
        </div>
      </div>

      <div className="w-full space-y-4 px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        <input
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none"
          placeholder="Search graders..."
          value={listSearch}
          onChange={(e) => setListSearch(e.target.value)}
        />

        {loading ? (
          <div className="flex justify-center py-16">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : filteredAllocations.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">
            {listSearch ? "No graders match your search." : "No graders assigned yet. Nominate students, then assign them to a teacher."}
          </p>
        ) : (
          <div className="space-y-2.5">
            {filteredAllocations.map((item) => (
              <div
                key={item.graderAllocationId}
                className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-gray-900">{item.graderName}</p>
                    <GraderBadge />
                  </div>
                  {item.graderAridNo ? (
                    <p className="mt-0.5 text-xs font-semibold text-gray-600">{item.graderAridNo}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-gray-500">
                    Assigned to {item.teacherName}
                    {item.teacherEmail ? ` · ${item.teacherEmail}` : ""}
                  </p>
                </div>
                <ListRowActions
                  onDelete={() => removeAllocation(item)}
                  deleteLabel="Remove assignment"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {modalVisible && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 p-0 sm:p-4 backdrop-blur-xs" onClick={closeAssignModal} role="presentation">
          <div
            className="flex max-h-[92dvh] sm:max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl shadow-xl"
            style={{ backgroundColor: "var(--surface)" }}
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <div className="border-b px-4 py-3 sm:px-6 sm:py-4" style={{ borderColor: "var(--border)" }}>
              <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-600 sm:hidden" />
              <h2 className="text-center text-lg font-semibold" style={{ color: "var(--text)" }}>Assign grader to teacher</h2>
              <p className="mt-1 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                Nominated students are listed below. Tick who to assign, pick a teacher, then Assign. The Grader badge is added after assignment.
              </p>
              {assignRefreshing ? (
                <p className="mt-1 text-center text-xs text-gray-500">Refreshing teachers and graders…</p>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
              <div>
                <label className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Search teacher by email</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
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
                  <span className="ml-1 font-normal text-gray-500">
                    ({selectedGraderIds.size} selected
                    {selectedTeacher && assignedToSelectedTeacher.length > 0
                      ? ` · ${assignedToSelectedTeacher.length} already on this teacher`
                      : ""}
                    )
                  </span>
                </label>
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
                      No nominated students yet. Select students first using Add grader (manual) or (file).
                    </p>
                  ) : filteredSelectableGraders.length === 0 && assignedGradersVisible.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                      No graders match your search.
                    </p>
                  ) : (
                    <>
                      {assignedGradersVisible.map((item) => {
                        const existingAllocation = findAllocationForGraderUser(item.userId, allocations);
                        const onThisTeacher =
                          selectedTeacher &&
                          isGraderAssignedToTeacherUser(item.userId, selectedTeacher.userId, allocations);
                        return (
                          <div
                            key={`assigned-${item.userId}`}
                            className="flex items-start gap-3 border-b px-3 py-2.5 last:border-b-0"
                            style={{ backgroundColor: "var(--surface-2)", borderBottomColor: "var(--border)" }}
                          >
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 shrink-0 accent-green-700"
                              checked={Boolean(onThisTeacher)}
                              disabled
                              readOnly
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{item.fullName}</span>
                                <GraderBadge />
                              </div>
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{item.email}</span>
                              {item.aridNo ? (
                                <span className="block text-xs" style={{ color: "var(--text-muted)" }}>{item.aridNo}</span>
                              ) : null}
                              <span
                                className="mt-1 block text-xs font-semibold"
                                style={{ color: onThisTeacher ? "var(--brand)" : "#f59e0b" }}
                              >
                                {onThisTeacher
                                  ? "Already assigned to this teacher"
                                  : `Already assigned to ${getAssignedTeacherName(existingAllocation)} — cannot reassign`}
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
                {!selectedTeacher ? (
                  <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    Choose a teacher above, then click Assign.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="border-t px-4 py-3 sm:px-6 sm:py-4" style={{ borderColor: "var(--border)" }}>
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
                className="min-h-[44px] w-full rounded-xl py-3 font-black text-white disabled:opacity-60"
                style={{ backgroundColor: theme.colors.primaryDark }}
              >
                {assignSaving
                  ? "Assigning…"
                  : selectedGraderIds.size > 1
                    ? `Assign ${selectedGraderIds.size} Graders`
                    : "Assign Grader"}
              </button>
              <button type="button" onClick={closeAssignModal} className="mt-2 min-h-[44px] w-full font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {manualGraderModalVisible && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 p-0 sm:p-4 backdrop-blur-xs"
          onClick={() => setManualGraderModalVisible(false)}
          role="presentation"
        >
          <div
            className="flex max-h-[92dvh] sm:max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl shadow-xl"
            style={{ backgroundColor: "var(--surface)" }}
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <div className="relative border-b px-4 py-3 sm:px-6 sm:py-4" style={{ borderColor: "var(--border)" }}>
              <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-600 sm:hidden" />
              <h2 className="text-center text-lg font-semibold" style={{ color: "var(--text)" }}>Nominate student as grader</h2>
              <p className="mt-1 text-center text-xs sm:text-sm" style={{ color: "var(--text-muted)" }}>
                Tick to select, untick to deselect. The Grader badge appears only after assignment to a teacher.
              </p>
              <button
                type="button"
                className="absolute right-4 top-3 text-2xl text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                onClick={() => setManualGraderModalVisible(false)}
              >
                ×
              </button>
            </div>

            <div className="space-y-3 border-b px-4 py-3 sm:px-6 sm:py-4" style={{ borderColor: "var(--border)" }}>
              <label className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Program</label>
              <AppSelect
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
              </AppSelect>

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
                    const assigned = Boolean(findGraderAllocationForStudent(student, graders, allocations));
                    const key = normalizeArid(student.aridNo);
                    const busy = addingStudentKey === key;

                    return (
                      <li
                        key={`${student.studentId}-${key}`}
                        className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 shrink-0 accent-green-700"
                          checked={nominated}
                          disabled={busy}
                          title={nominated ? "Untick to deselect" : "Tick to select"}
                          onChange={() => toggleStudentNomination(student, nominated)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className="text-sm font-semibold"
                              style={{ color: "var(--text)" }}
                            >
                              {student.fullName}
                            </p>
                            {assigned ? <GraderBadge /> : null}
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

            <div className="border-t border-gray-100 px-4 py-3 sm:px-6 sm:py-4 dark:border-[#1b2c2e]">
              <button
                type="button"
                onClick={() => setManualGraderModalVisible(false)}
                className="min-h-[44px] w-full rounded-xl font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {graderImportModalVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-4 backdrop-blur-xs"
          onClick={() => setGraderImportModalVisible(false)}
          role="presentation"
        >
          <div className="max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-xl dark:bg-[#0c181a] dark:text-white" onClick={(e) => e.stopPropagation()} role="presentation">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add grader (Excel)</h2>
                <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  Upload a .xlsx file with student ARIDs from the selected program. Each valid row creates a grader user.
                </p>
              </div>
              <button type="button" onClick={() => setGraderImportModalVisible(false)} className="text-2xl text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                ×
              </button>
            </div>

            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-[#1b2c2e] dark:bg-[#122427]">
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
            <AppSelect
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
            </AppSelect>

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
