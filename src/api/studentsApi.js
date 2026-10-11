import request from "./apiClient";
import { appendFormFile } from "../utils/appendFormFile";
import { getSessionsByProgram } from "./sessionsApi";
import { getSectionsBySession } from "./sectionsApi";
import { normalizeArid } from "../utils/graderHelpers";

export const getStudentsBySection = async (sectionId) => {
  return await request(`/Students/by-section/${sectionId}`);
};

/** All students across every section in every session of a program (deduped by ARID). */
export const getStudentsByProgram = async (programId) => {
  const sessions = await getSessionsByProgram(programId);
  const sectionGroups = await Promise.all(
    (sessions || []).map(async (session) => {
      const sections = await getSectionsBySession(session.sessionId);
      return (sections || []).map((section) => ({ session, section }));
    })
  );
  const pairs = sectionGroups.flat();
  const studentGroups = await Promise.all(
    pairs.map(async ({ session, section }) => {
      const rows = await getStudentsBySection(section.sectionId);
      return (rows || []).map((student) => ({
        ...student,
        sectionId: section.sectionId,
        sectionName: section.sectionName,
        sessionId: session.sessionId,
        sessionTitle: session.sessionTitle,
        programId: session.programId ?? programId,
      }));
    })
  );

  const deduped = new Map();
  for (const student of studentGroups.flat()) {
    const key = normalizeArid(student.aridNo);
    if (!key) continue;
    if (!deduped.has(key)) deduped.set(key, student);
  }
  return Array.from(deduped.values()).sort((a, b) =>
    normalizeArid(a.aridNo).localeCompare(normalizeArid(b.aridNo))
  );
};

/** Every student registered under any of the given programs (deduped by ARID). */
export const getAllRegisteredStudents = async (programs) => {
  if (!programs?.length) return [];
  const groups = await Promise.all(programs.map((program) => getStudentsByProgram(program.programId)));
  const deduped = new Map();
  for (const student of groups.flat()) {
    const key = normalizeArid(student.aridNo);
    if (!key) continue;
    if (!deduped.has(key)) deduped.set(key, student);
  }
  return Array.from(deduped.values());
};

export const createStudent = async (student) => {
  return await request("/Students", {
    method: "POST",
    body: JSON.stringify(student),
  });
};

export const updateStudent = async (studentId, student) => {
  return await request(`/Students/${studentId}`, {
    method: "PUT",
    body: JSON.stringify(student),
  });
};

export const deleteStudent = async (studentId) => {
  return await request(`/Students/${studentId}`, {
    method: "DELETE",
  });
};

export const importStudentsBySection = async (sectionId, file) => {
  const formData = new FormData();
  appendFormFile(formData, "file", file, "students.xlsx");

  return await request(`/Students/import-section/${sectionId}`, {
    method: "POST",
    body: formData,
    timeoutMs: 120000,
  });
};

export async function getEnrollmentBySession(sessionId) {
  return await request(`/Students/enrollment/by-session/${sessionId}`);
}

export async function enrollStudentInOfferedCourse(payload) {
  return await request("/Students/enroll", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function addStudentEnrollment(studentId, offeredCourseId) {
  return await request(`/Students/${studentId}/enrollments`, {
    method: "POST",
    body: JSON.stringify({ offeredCourseId }),
  });
}

export async function removeStudentEnrollment(studentId, offeredCourseId) {
  return await request(`/Students/${studentId}/enrollments/${offeredCourseId}`, {
    method: "DELETE",
  });
}

export async function getStudentsByOfferedCourse(offeredCourseId) {
  return await request(`/Students/by-offered-course/${offeredCourseId}`);
}

export async function importEnrollmentBySession(sessionId, file) {
  const formData = new FormData();
  appendFormFile(formData, "file", file, "enrollment.xlsx");
  return await request(`/Students/import-enrollment/${sessionId}`, {
    method: "POST",
    body: formData,
    timeoutMs: 120000,
  });
}