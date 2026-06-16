import request, { API_BASE_URL } from "./apiClient";
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

  const response = await fetch(
    `${API_BASE_URL}/Students/import-section/${sectionId}`,
    {
      method: "POST",
      body: formData,
    }
  );

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || "Failed to import students.");
  }

  return data;
};