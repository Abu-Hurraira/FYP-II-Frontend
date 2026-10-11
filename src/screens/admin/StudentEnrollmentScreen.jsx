import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { getPrograms } from "../../api/programsApi";
import { getSessionsByProgram } from "../../api/sessionsApi";
import { getSectionsBySession } from "../../api/sectionsApi";
import { getOfferedCoursesBySession } from "../../api/offeredCoursesApi";
import {
  addStudentEnrollment,
  deleteStudent,
  enrollStudentInOfferedCourse,
  getEnrollmentBySession,
  importEnrollmentBySession,
  removeStudentEnrollment,
  updateStudent,
} from "../../api/studentsApi";
import AppSelect from "../../components/AppSelect.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import AddHeaderButton from "../../components/AddHeaderButton.jsx";
import theme from "../../styles/theme";
import { showAlert, showConfirm } from "../../utils/dialogs";

const NEW_STUDENT_VALUE = "__new__";

const emptyForm = () => ({
  sectionId: "",
  offeredCourseId: "",
  studentPick: "",
  fullName: "",
  aridNo: "",
  email: "",
});

function optionId(value) {
  return value == null || value === "" ? "" : String(value);
}

function offeringLabel(item) {
  const code = item.courseCode ?? item.CourseCode ?? "";
  const title = item.courseTitle ?? item.CourseTitle ?? "Course";
  const section = item.sectionName ?? item.SectionName ?? "";
  const teacher = item.teacherName ?? item.TeacherName ?? "";
  return [section, code ? `${title} (${code})` : title, teacher].filter(Boolean).join(" · ");
}

function studentIdOf(row) {
  return optionId(row?.studentId ?? row?.StudentId);
}

function studentNameOf(row) {
  return String(row?.fullName ?? row?.FullName ?? "").trim();
}

function studentAridOf(row) {
  return String(row?.aridNo ?? row?.AridNo ?? "").trim();
}

function studentEmailOf(row) {
  return String(row?.email ?? row?.Email ?? "").trim();
}

function studentLabel(row) {
  const name = studentNameOf(row);
  const arid = studentAridOf(row);
  return arid ? `${name} (${arid})` : name || `Student ${studentIdOf(row)}`;
}

function studentEnrolledInCourse(row, offeredCourseId) {
  if (!offeredCourseId) return false;
  const enrollments = row?.enrollments ?? row?.Enrollments ?? [];
  return enrollments.some(
    (link) => String(link.offeredCourseId ?? link.OfferedCourseId) === String(offeredCourseId)
  );
}

export default function StudentEnrollmentScreen() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const presetProgramId = location.state?.programId ?? location.state?.program?.programId ?? "";
  const presetSessionId = location.state?.sessionId ?? location.state?.session?.sessionId ?? "";

  const [programs, setPrograms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sections, setSections] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [rows, setRows] = useState([]);

  const [programId, setProgramId] = useState(optionId(presetProgramId));
  const [sessionId, setSessionId] = useState(optionId(presetSessionId));
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editStudent, setEditStudent] = useState(null);
  const [editForm, setEditForm] = useState({ fullName: "", aridNo: "", email: "", sectionId: "" });
  const [addCourseId, setAddCourseId] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingPrograms(true);
        const list = (await getPrograms()) || [];
        if (!cancelled) setPrograms(list);
      } catch (error) {
        if (!cancelled) showAlert("Error", error.message);
      } finally {
        if (!cancelled) setLoadingPrograms(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSessions = async (pid, keepSessionId) => {
    if (!pid) {
      setSessions([]);
      return;
    }
    try {
      setLoadingSessions(true);
      const list = (await getSessionsByProgram(pid)) || [];
      setSessions(list);
      if (keepSessionId && list.some((s) => String(s.sessionId) === String(keepSessionId))) {
        setSessionId(String(keepSessionId));
      }
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadSessionData = async (sid) => {
    if (!sid) {
      setSections([]);
      setOfferings([]);
      setRows([]);
      return;
    }
    try {
      setLoadingRows(true);
      const [sectionList, offeringList, enrollmentRows] = await Promise.all([
        getSectionsBySession(sid),
        getOfferedCoursesBySession(sid),
        getEnrollmentBySession(sid),
      ]);
      setSections(sectionList || []);
      setOfferings(offeringList || []);
      setRows(enrollmentRows || []);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoadingRows(false);
    }
  };

  useEffect(() => {
    if (programId) loadSessions(programId, sessionId);
  }, [programId]);

  useEffect(() => {
    loadSessionData(sessionId);
  }, [sessionId]);

  const offeringsForFormSection = useMemo(() => {
    const sid = addVisible ? form.sectionId : editForm.sectionId;
    if (!sid) return offerings;
    const byId = offerings.filter((o) => String(o.sectionId ?? o.SectionId) === String(sid));
    if (byId.length) return byId;
    const section = sections.find((s) => String(s.sectionId ?? s.SectionId) === String(sid));
    const sectionName = section?.sectionName ?? section?.SectionName;
    if (!sectionName) return offerings;
    return offerings.filter((o) => String(o.sectionName ?? o.SectionName) === String(sectionName));
  }, [offerings, sections, form.sectionId, editForm.sectionId, addVisible]);

  const studentsInFormSection = useMemo(() => {
    if (!form.sectionId) return [];
    return rows.filter((row) => String(row.sectionId ?? row.SectionId) === String(form.sectionId));
  }, [rows, form.sectionId]);

  const isNewStudent = form.studentPick === NEW_STUDENT_VALUE;
  const pickedExistingStudent = studentsInFormSection.find(
    (row) => studentIdOf(row) === String(form.studentPick)
  );
  const pickedAlreadyEnrolled =
    Boolean(pickedExistingStudent) &&
    Boolean(form.offeredCourseId) &&
    studentEnrolledInCourse(pickedExistingStudent, form.offeredCourseId);

  const pickProgram = (value) => {
    setProgramId(value);
    setSessionId("");
    setSessions([]);
    setRows([]);
    setSections([]);
    setOfferings([]);
  };

  const refreshEditStudent = async (studentId) => {
    const refreshed = (await getEnrollmentBySession(sessionId)) || [];
    setRows(refreshed);
    const next = refreshed.find((r) => Number(r.studentId ?? r.StudentId) === Number(studentId));
    if (next) setEditStudent(next);
    return next;
  };

  const openAdd = () => {
    if (!sessionId) {
      showAlert("Required", "Select a program and session first.");
      return;
    }
    if (!sections.length) {
      showAlert("No sections", "Create sections and offered courses first.");
      return;
    }
    setForm({
      ...emptyForm(),
      sectionId: optionId(sections[0]?.sectionId ?? sections[0]?.SectionId),
    });
    setAddVisible(true);
  };

  const pickSection = (sectionId) => {
    setForm({
      ...emptyForm(),
      sectionId,
    });
  };

  const pickOfferedCourse = (offeredCourseId) => {
    setForm((prev) => ({ ...prev, offeredCourseId }));
  };

  const pickExistingOrNewStudent = (value) => {
    if (value === NEW_STUDENT_VALUE) {
      setForm((prev) => ({
        ...prev,
        studentPick: NEW_STUDENT_VALUE,
        fullName: "",
        aridNo: "",
        email: "",
      }));
      return;
    }

    const row = studentsInFormSection.find((item) => studentIdOf(item) === String(value));
    if (!row) {
      setForm((prev) => ({ ...prev, studentPick: "", fullName: "", aridNo: "", email: "" }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      studentPick: studentIdOf(row),
      fullName: studentNameOf(row),
      aridNo: studentAridOf(row),
      email: studentEmailOf(row),
    }));
  };

  const saveAdd = async () => {
    if (!form.sectionId || !form.offeredCourseId) {
      showAlert("Required", "Choose a section and offered course.");
      return;
    }
    if (!form.studentPick) {
      showAlert("Required", "Choose an existing student or New student.");
      return;
    }
    if (!form.fullName.trim() || !form.aridNo.trim()) {
      showAlert("Required", "Enter student name and ARID / Reg no.");
      return;
    }
    if (pickedAlreadyEnrolled) {
      showAlert("Already enrolled", "This student is already enrolled in the selected course.");
      return;
    }
    try {
      setSaving(true);
      let result;
      if (pickedExistingStudent) {
        result = await addStudentEnrollment(
          Number(studentIdOf(pickedExistingStudent)),
          Number(form.offeredCourseId)
        );
      } else {
        result = await enrollStudentInOfferedCourse({
          sectionId: Number(form.sectionId),
          offeredCourseId: Number(form.offeredCourseId),
          fullName: form.fullName.trim(),
          aridNo: form.aridNo.trim(),
          email: form.email.trim() || null,
        });
      }
      setAddVisible(false);
      showAlert("Saved", result.message || "Student enrolled.");
      await loadSessionData(sessionId);
    } catch (error) {
      showAlert("Save failed", error.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row) => {
    setEditStudent(row);
    setEditForm({
      fullName: row.fullName ?? row.FullName ?? "",
      aridNo: row.aridNo ?? row.AridNo ?? "",
      email: row.email ?? row.Email ?? "",
      sectionId: optionId(row.sectionId ?? row.SectionId),
    });
    setAddCourseId("");
    setEditVisible(true);
  };

  const saveEdit = async () => {
    if (!editStudent) return;
    if (!editForm.fullName.trim() || !editForm.aridNo.trim() || !editForm.sectionId) {
      showAlert("Required", "Name, ARID, and section are required.");
      return;
    }
    try {
      setSaving(true);
      const result = await updateStudent(editStudent.studentId ?? editStudent.StudentId, {
        sectionId: Number(editForm.sectionId),
        fullName: editForm.fullName.trim(),
        aridNo: editForm.aridNo.trim(),
        email: editForm.email.trim() || null,
      });
      showAlert("Updated", result.message || "Student updated.");
      const next = await refreshEditStudent(editStudent.studentId ?? editStudent.StudentId);
      if (next) {
        setEditForm({
          fullName: next.fullName ?? next.FullName ?? "",
          aridNo: next.aridNo ?? next.AridNo ?? "",
          email: next.email ?? next.Email ?? "",
          sectionId: optionId(next.sectionId ?? next.SectionId),
        });
      } else {
        setEditVisible(false);
      }
    } catch (error) {
      showAlert("Update failed", error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddEnrollment = async () => {
    if (!editStudent || !addCourseId) {
      showAlert("Required", "Choose an offered course to add.");
      return;
    }
    try {
      setSaving(true);
      const result = await addStudentEnrollment(editStudent.studentId ?? editStudent.StudentId, Number(addCourseId));
      showAlert("Enrollment", result.message || "Enrolled.");
      setAddCourseId("");
      await refreshEditStudent(editStudent.studentId ?? editStudent.StudentId);
    } catch (error) {
      showAlert("Failed", error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveEnrollment = async (link) => {
    if (!editStudent) return;
    const code = link.courseCode ?? link.CourseCode ?? "this course";
    if (!(await showConfirm("Remove enrollment?", `Remove ${code} from this student?`))) return;
    try {
      setSaving(true);
      await removeStudentEnrollment(
        editStudent.studentId ?? editStudent.StudentId,
        link.offeredCourseId ?? link.OfferedCourseId
      );
      await refreshEditStudent(editStudent.studentId ?? editStudent.StudentId);
    } catch (error) {
      showAlert("Failed", error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!editStudent) return;
    const name = editStudent.fullName ?? editStudent.FullName;
    const arid = editStudent.aridNo ?? editStudent.AridNo;
    if (!(await showConfirm("Delete student?", `Delete ${name} (${arid}) and all enrollments / marks?`))) return;
    try {
      setSaving(true);
      await deleteStudent(editStudent.studentId ?? editStudent.StudentId);
      setEditVisible(false);
      await loadSessionData(sessionId);
    } catch (error) {
      showAlert("Failed", error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    if (!sessionId) {
      showAlert("Required", "Select a program and session first.");
      return;
    }
    if (!selectedFile) {
      showAlert("Required", "Choose an Excel (.xlsx) file.");
      return;
    }
    try {
      setUploading(true);
      const result = await importEnrollmentBySession(sessionId, selectedFile);
      showAlert(
        "Import finished",
        [
          `Students added: ${result.insertedCount ?? result.InsertedCount ?? 0}`,
          `Students updated: ${result.updatedCount ?? result.UpdatedCount ?? 0}`,
          `Course enrollments linked: ${result.linkedEnrollmentCount ?? result.LinkedEnrollmentCount ?? 0}`,
          `Duplicate enrollments skipped: ${result.skippedCount ?? result.SkippedCount ?? 0}`,
          `Errors: ${result.errorCount ?? result.ErrorCount ?? 0}`,
        ].join("\n")
      );
      setSelectedFile(null);
      await loadSessionData(sessionId);
    } catch (error) {
      showAlert("Import failed", error.message);
    } finally {
      setUploading(false);
    }
  };

  const enrolledIds = new Set(
    (editStudent?.enrollments ?? editStudent?.Enrollments ?? []).map((link) =>
      Number(link.offeredCourseId ?? link.OfferedCourseId)
    )
  );
  const addableOfferings = offeringsForFormSection.filter(
    (item) => !enrolledIds.has(Number(item.offeredCourseId ?? item.OfferedCourseId))
  );

  return (
    <div className="relative min-h-full bg-page">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-gray-900">Course Enrollment</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            {user?.roleName || "SectionAdmin"} · Link students to offered courses for mark sheets
          </p>
        </div>
        <AddHeaderButton label="Enroll student" onClick={openAdd} />
      </div>

      <div className="w-full space-y-4 px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        <div className="grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:grid-cols-2">
          <label className="text-xs font-extrabold text-gray-600">
            Program
            <AppSelect
              className="mt-1 w-full"
              value={programId}
              onChange={(e) => pickProgram(e.target.value)}
              disabled={loadingPrograms}
            >
              <option value="">Select program</option>
              {programs.map((item) => (
                <option key={item.programId} value={item.programId}>
                  {item.programName ?? item.programCode ?? `Program ${item.programId}`}
                </option>
              ))}
            </AppSelect>
          </label>
          <label className="text-xs font-extrabold text-gray-600">
            Session
            <AppSelect
              className="mt-1 w-full"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              disabled={!programId || loadingSessions}
            >
              <option value="">Select session</option>
              {sessions.map((item) => (
                <option key={item.sessionId} value={item.sessionId}>
                  {item.sessionTitle ?? item.sessionName ?? `Session ${item.sessionId}`}
                </option>
              ))}
            </AppSelect>
          </label>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-extrabold text-gray-900">Import enrollments</p>
          <p className="mt-1 text-xs text-gray-500">
            Excel columns: <strong>Reg_no</strong>, <strong>StuName</strong>, <strong>Section</strong> (e.g. BSCS-1A),{" "}
            <strong>Course Code</strong> or Course Title. Offered courses must already exist.
          </p>
          <label className="mt-3 flex h-11 cursor-pointer items-center rounded-lg bg-gray-100 px-3 text-sm">
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
            {selectedFile ? selectedFile.name : "Select .xlsx file"}
          </label>
          <button
            type="button"
            disabled={uploading}
            onClick={handleImport}
            className="mt-3 w-full rounded-lg py-2.5 text-sm font-black text-white disabled:opacity-60"
            style={{ backgroundColor: theme.colors.primaryDark }}
          >
            {uploading ? "Importing…" : "Import for this session"}
          </button>
        </div>

        {loadingRows ? (
          <div className="flex justify-center py-16">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : !sessionId ? (
          <p className="py-10 text-center text-sm text-gray-500">Select a session to see enrollments.</p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">No students in this session yet.</p>
        ) : (
          <div className="space-y-2.5">
            {rows.map((item) => {
              const enrollments = item.enrollments ?? item.Enrollments ?? [];
              return (
                <button
                  key={item.studentId ?? item.StudentId}
                  type="button"
                  onClick={() => openEdit(item)}
                  className="flex w-full items-start justify-between rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition hover:bg-brand-muted/40"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">{item.fullName ?? item.FullName}</p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-600">
                      {item.aridNo ?? item.AridNo} · {item.sectionName ?? item.SectionName}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {enrollments.length
                        ? enrollments
                            .map((link) => link.courseCode ?? link.CourseCode)
                            .filter(Boolean)
                            .join(", ")
                        : "No offered-course enrollments"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xl text-gray-300">›</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {addVisible ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={() => setAddVisible(false)} role="presentation">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} role="presentation">
            <h2 className="mb-4 text-center text-lg font-semibold">Enroll student</h2>
            <label className="mb-3 block text-xs font-extrabold text-gray-600">
              Section
              <AppSelect className="mt-1 w-full" value={form.sectionId} onChange={(e) => pickSection(e.target.value)}>
                <option value="">Select section</option>
                {sections.map((item) => (
                  <option key={item.sectionId} value={item.sectionId}>
                    {item.sectionName}
                  </option>
                ))}
              </AppSelect>
            </label>
            <label className="mb-3 block text-xs font-extrabold text-gray-600">
              Offered course
              <AppSelect className="mt-1 w-full" value={form.offeredCourseId} onChange={(e) => pickOfferedCourse(e.target.value)}>
                <option value="">Select course</option>
                {offeringsForFormSection.map((item) => (
                  <option key={item.offeredCourseId} value={item.offeredCourseId}>
                    {offeringLabel(item)}
                  </option>
                ))}
              </AppSelect>
            </label>
            <label className="mb-3 block text-xs font-extrabold text-gray-600">
              Student
              <AppSelect
                className="mt-1 w-full"
                value={form.studentPick}
                onChange={(e) => pickExistingOrNewStudent(e.target.value)}
                disabled={!form.sectionId}
              >
                <option value="">Select student</option>
                {studentsInFormSection.map((item) => {
                  const alreadyInCourse =
                    Boolean(form.offeredCourseId) && studentEnrolledInCourse(item, form.offeredCourseId);
                  return (
                    <option key={studentIdOf(item)} value={studentIdOf(item)}>
                      {alreadyInCourse ? `${studentLabel(item)} · already enrolled` : studentLabel(item)}
                    </option>
                  );
                })}
                <option value={NEW_STUDENT_VALUE}>New student (type details)</option>
              </AppSelect>
            </label>
            {pickedAlreadyEnrolled ? (
              <p className="mb-3 text-xs font-semibold text-amber-700">
                This student is already enrolled in the selected course. Pick another course, or New student.
              </p>
            ) : form.sectionId && studentsInFormSection.length === 0 ? (
              <p className="mb-3 text-xs text-gray-500">
                No students in this section yet. Choose New student to type name and ARID.
              </p>
            ) : (
              <p className="mb-3 text-xs text-gray-500">
                Pick a section student, then a course. Use New student only if they are not in the section yet.
              </p>
            )}
            {pickedExistingStudent ? (
              <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                <p className="text-sm font-bold text-gray-900">{studentNameOf(pickedExistingStudent)}</p>
                <p className="mt-0.5 text-xs font-semibold text-gray-600">{studentAridOf(pickedExistingStudent)}</p>
                {studentEmailOf(pickedExistingStudent) ? (
                  <p className="mt-0.5 text-xs text-gray-500">{studentEmailOf(pickedExistingStudent)}</p>
                ) : null}
              </div>
            ) : isNewStudent ? (
              <>
                <input className="mb-3 w-full rounded-lg border px-3 py-2 placeholder:text-gray-400" placeholder="e.g. Ali Khan" value={form.fullName} onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))} />
                <input className="mb-3 w-full rounded-lg border px-3 py-2 placeholder:text-gray-400" placeholder="e.g. 23-Arid-0000" value={form.aridNo} onChange={(e) => setForm((prev) => ({ ...prev, aridNo: e.target.value }))} />
                <input className="mb-4 w-full rounded-lg border px-3 py-2 placeholder:text-gray-400" placeholder="e.g. ali@biit.edu.pk (optional)" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
              </>
            ) : (
              <div className="mb-4" />
            )}
            <button type="button" disabled={saving || pickedAlreadyEnrolled} onClick={saveAdd} className="w-full rounded-lg py-3 font-black text-white disabled:opacity-60" style={{ backgroundColor: theme.colors.primaryDark }}>
              {saving ? "Saving…" : pickedAlreadyEnrolled ? "Already enrolled" : "Enroll"}
            </button>
            <button type="button" onClick={() => setAddVisible(false)} className="mt-3 w-full font-bold text-gray-500">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {editVisible && editStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={() => setEditVisible(false)} role="presentation">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} role="presentation">
            <h2 className="mb-4 text-center text-lg font-semibold">Student enrollments</h2>
            <input className="mb-3 w-full rounded-lg border px-3 py-2 placeholder:text-gray-400" placeholder="e.g. Ali Khan" value={editForm.fullName} onChange={(e) => setEditForm((prev) => ({ ...prev, fullName: e.target.value }))} />
            <input className="mb-3 w-full rounded-lg border px-3 py-2 placeholder:text-gray-400" placeholder="e.g. 23-Arid-0000" value={editForm.aridNo} onChange={(e) => setEditForm((prev) => ({ ...prev, aridNo: e.target.value }))} />
            <input className="mb-3 w-full rounded-lg border px-3 py-2 placeholder:text-gray-400" placeholder="e.g. ali@biit.edu.pk (optional)" value={editForm.email} onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))} />
            <label className="mb-3 block text-xs font-extrabold text-gray-600">
              Section
              <AppSelect className="mt-1 w-full" value={editForm.sectionId} onChange={(e) => setEditForm((prev) => ({ ...prev, sectionId: e.target.value }))}>
                {sections.map((item) => (
                  <option key={item.sectionId} value={item.sectionId}>
                    {item.sectionName}
                  </option>
                ))}
              </AppSelect>
            </label>
            <button type="button" disabled={saving} onClick={saveEdit} className="w-full rounded-lg py-2.5 font-black text-white disabled:opacity-60" style={{ backgroundColor: theme.colors.primaryDark }}>
              {saving ? "Saving…" : "Save student"}
            </button>

            <p className="mt-5 text-xs font-extrabold uppercase tracking-wide text-gray-500">Enrolled courses</p>
            <div className="mt-2 space-y-2">
              {(editStudent.enrollments ?? editStudent.Enrollments ?? []).map((link) => (
                <div key={link.studentOfferedCourseId ?? link.StudentOfferedCourseId ?? link.offeredCourseId} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">{link.courseCode ?? link.CourseCode} · {link.courseTitle ?? link.CourseTitle}</p>
                    <p className="text-xs text-gray-500">{link.teacherName ?? link.TeacherName}</p>
                  </div>
                  <button type="button" disabled={saving} onClick={() => handleRemoveEnrollment(link)} className="text-xs font-extrabold text-red-600">
                    Remove
                  </button>
                </div>
              ))}
              {(editStudent.enrollments ?? editStudent.Enrollments ?? []).length === 0 ? (
                <p className="text-xs text-gray-500">Not enrolled in any offered course yet.</p>
              ) : null}
            </div>

            <label className="mt-4 block text-xs font-extrabold text-gray-600">
              Add offered course
              <AppSelect
                className="mt-1 w-full"
                value={addCourseId}
                onChange={(e) => setAddCourseId(e.target.value)}
                emptyLabel="No remaining courses for this section"
              >
                <option value="">Select course</option>
                {addableOfferings.map((item) => (
                  <option key={item.offeredCourseId ?? item.OfferedCourseId} value={item.offeredCourseId ?? item.OfferedCourseId}>
                    {offeringLabel(item)}
                  </option>
                ))}
              </AppSelect>
            </label>
            {addableOfferings.length === 0 ? (
              <p className="mt-2 text-xs text-gray-500">
                {offeringsForFormSection.length === 0
                  ? "No offered courses exist for this section yet. Add them under Programs → Session → Offered Courses."
                  : "This student is already enrolled in every offered course for this section. Remove one above if you need to change it."}
              </p>
            ) : (
              <button type="button" disabled={saving} onClick={handleAddEnrollment} className="mt-2 w-full rounded-lg border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-extrabold text-emerald-800 disabled:opacity-60">
                Add enrollment
              </button>
            )}
            <button type="button" disabled={saving} onClick={handleDeleteStudent} className="mt-3 w-full font-bold text-red-600">
              Delete student
            </button>
            <button type="button" onClick={() => setEditVisible(false)} className="mt-2 w-full font-bold text-gray-500">
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
