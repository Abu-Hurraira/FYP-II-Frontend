import { GRADER_ROLE_ID } from "./constants";

export { GRADER_ROLE_ID };

export function normalizeArid(value) {
  if (value == null || value === "") return "";
  return String(value).trim().toUpperCase();
}

export function buildGraderAridSet(graders) {
  const set = new Set();
  for (const g of graders || []) {
    const arid = normalizeArid(g.aridNo ?? g.AridNo);
    if (arid) set.add(arid);
  }
  return set;
}

export function isStudentNominatedGrader(student, graderAridSet) {
  return graderAridSet.has(normalizeArid(student?.aridNo));
}

export function findStudentForGraderUser(grader, students) {
  const { byArid, byEmail } = buildStudentLookupMaps(students);
  const arid = normalizeArid(grader?.aridNo ?? grader?.AridNo);
  if (arid && byArid.has(arid)) return byArid.get(arid);

  const email = String(grader?.email ?? grader?.Email ?? "").trim().toLowerCase();
  if (email && byEmail.has(email)) return byEmail.get(email);

  return null;
}

export function filterGradersLinkedToStudents(graders, students) {
  return (graders || []).filter((grader) => findStudentForGraderUser(grader, students));
}

export function isGraderLinkedToRegisteredStudent(grader, students) {
  return !!findStudentForGraderUser(grader, students);
}

export function findGraderUserForStudent(student, graders) {
  const arid = normalizeArid(student?.aridNo);
  const email = String(student?.email || "").trim().toLowerCase();
  return (
    (graders || []).find((grader) => {
      if (arid && normalizeArid(grader.aridNo ?? grader.AridNo) === arid) return true;
      if (email && String(grader.email ?? grader.Email ?? "").trim().toLowerCase() === email) return true;
      return false;
    }) || null
  );
}

export function findGraderAllocationForStudent(student, graders, allocations) {
  const graderUser = findGraderUserForStudent(student, graders);
  if (!graderUser?.userId) return null;

  return (
    (allocations || []).find(
      (item) => Number(item.graderUserId ?? item.GraderUserId) === Number(graderUser.userId)
    ) || null
  );
}

export function getAssignedTeacherName(allocation) {
  if (!allocation) return "";
  return String(allocation.teacherName ?? allocation.TeacherName ?? "").trim();
}

export function findAllocationForGraderUser(graderUserId, allocations) {
  return (
    (allocations || []).find(
      (item) => Number(item.graderUserId ?? item.GraderUserId) === Number(graderUserId)
    ) || null
  );
}

export function isGraderAssignedToTeacher(graderUserId, allocations) {
  return !!findAllocationForGraderUser(graderUserId, allocations);
}

export function findAllocationForGraderAndTeacher(graderUserId, teacherUserId, allocations) {
  return (
    (allocations || []).find(
      (item) =>
        Number(item.graderUserId ?? item.GraderUserId) === Number(graderUserId) &&
        Number(item.teacherUserId ?? item.TeacherUserId) === Number(teacherUserId)
    ) || null
  );
}

export function isGraderAssignedToTeacherUser(graderUserId, teacherUserId, allocations) {
  if (!teacherUserId) return false;
  return !!findAllocationForGraderAndTeacher(graderUserId, teacherUserId, allocations);
}

export function getGradersAssignedToTeacher(teacherUserId, allocations) {
  if (!teacherUserId) return [];
  return (allocations || []).filter(
    (item) => Number(item.teacherUserId ?? item.TeacherUserId) === Number(teacherUserId)
  );
}

export function matchesEmailSearch(user, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const email = String(user?.email ?? user?.Email ?? "").toLowerCase();
  const name = String(user?.fullName ?? user?.FullName ?? "").toLowerCase();
  return email.includes(q) || name.includes(q);
}

export function matchesGraderSearch(grader, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const email = String(grader?.email ?? "").toLowerCase();
  const arid = normalizeArid(grader?.aridNo).toLowerCase();
  const name = String(grader?.fullName ?? "").toLowerCase();
  return email.includes(q) || arid.includes(q) || name.includes(q);
}

/** Example rows shown in the grader Excel import modal. */
export const GRADER_IMPORT_SAMPLE_ROWS = [
  { ARID: "23-ARID-0123", Email: "aliislam@gmail.com" },
  { ARID: "24-ARID-0456", Email: "" },
  { ARID: "24-ARID-0789", Email: "student@biit.edu.pk" },
];

export function defaultGraderEmail(student) {
  const email = String(student?.email || "").trim();
  if (email) return email;
  const slug = normalizeArid(student.aridNo).replace(/-/g, "").toLowerCase();
  return `${slug}@biit.edu.pk`;
}

export function buildGraderUserPayload(student) {
  const aridNo = String(student.aridNo || "").trim();
  return {
    fullName: String(student.fullName || "").trim(),
    email: defaultGraderEmail(student),
    password: aridNo,
    roleId: GRADER_ROLE_ID,
    rank: "Grader",
    aridNo,
  };
}

function pickRowValue(row, keys) {
  const entries = Object.entries(row || {});
  for (const key of keys) {
    const target = key.toLowerCase();
    const hit = entries.find(([k]) => String(k).trim().toLowerCase() === target);
    if (hit && String(hit[1] ?? "").trim()) return String(hit[1]).trim();
  }
  for (const [k, v] of entries) {
    const lower = String(k).trim().toLowerCase();
    if (keys.some((key) => lower.includes(key.toLowerCase())) && String(v ?? "").trim()) {
      return String(v).trim();
    }
  }
  return "";
}

export function matchStudentFromImportRow(row, studentsByArid, studentsByEmail) {
  const arid = normalizeArid(
    pickRowValue(row, ["arid", "aridno", "arid no", "arid number", "ardi", "ardi no", "ardi number", "roll", "roll no", "rollno"])
  );
  if (arid && studentsByArid.has(arid)) return studentsByArid.get(arid);

  const email = pickRowValue(row, ["email", "mail"]).toLowerCase();
  if (email && studentsByEmail.has(email)) return studentsByEmail.get(email);

  const firstValue = Object.values(row || {}).map((v) => String(v ?? "").trim()).find(Boolean);
  const fromFirst = normalizeArid(firstValue);
  if (fromFirst && studentsByArid.has(fromFirst)) return studentsByArid.get(fromFirst);

  return null;
}

export async function parseExcelRows(file) {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
}

export function buildStudentLookupMaps(students) {
  const byArid = new Map();
  const byEmail = new Map();
  for (const student of students || []) {
    const arid = normalizeArid(student.aridNo);
    if (arid) byArid.set(arid, student);
    const email = String(student.email || "").trim().toLowerCase();
    if (email) byEmail.set(email, student);
  }
  return { byArid, byEmail };
}
