import request from "./apiClient";
import { appendFormFile } from "../utils/appendFormFile";

function normalizeSheet(raw) {
  if (!raw || typeof raw !== "object") return raw;
  return {
    offeredCourseId: raw.offeredCourseId ?? raw.OfferedCourseId,
    courseTitle: raw.courseTitle ?? raw.CourseTitle ?? "",
    sectionName: raw.sectionName ?? raw.SectionName ?? "",
    attendanceSheetPath: raw.attendanceSheetPath ?? raw.AttendanceSheetPath ?? null,
    dates: raw.dates ?? raw.Dates ?? [],
    students: (raw.students ?? raw.Students ?? []).map((s) => ({
      studentId: s.studentId ?? s.StudentId,
      fullName: s.fullName ?? s.FullName ?? "",
      aridNo: s.aridNo ?? s.AridNo ?? "",
      cells: (s.cells ?? s.Cells ?? []).map((c) => ({
        attendanceId: c.attendanceId ?? c.AttendanceId ?? null,
        date: c.date ?? c.Date ?? "",
        status: c.status ?? c.Status ?? "",
      })),
    })),
  };
}

export async function getAttendanceSheet(offeredCourseId, teacherUserId) {
  const data = await request(
    `/Attendance/offered-course/${offeredCourseId}?teacherUserId=${teacherUserId || ""}`
  );
  return normalizeSheet(data);
}

export async function importAttendanceSheet(offeredCourseId, teacherUserId, file) {
  const formData = new FormData();
  formData.append("teacherUserId", String(teacherUserId));
  appendFormFile(formData, "file", file, "attendance.xlsx");
  const data = await request(`/Attendance/offered-course/${offeredCourseId}/import`, {
    method: "POST",
    body: formData,
    timeoutMs: 120000,
  });
  return {
    message: data.message ?? data.Message ?? "Imported.",
    upsertedCount: data.upsertedCount ?? data.UpsertedCount ?? 0,
    skippedCount: data.skippedCount ?? data.SkippedCount ?? 0,
    errorCount: data.errorCount ?? data.ErrorCount ?? 0,
    errors: data.errors ?? data.Errors ?? [],
    sheet: data.sheet || data.Sheet ? normalizeSheet(data.sheet ?? data.Sheet) : null,
  };
}

export async function updateAttendanceSheet(offeredCourseId, teacherUserId, updates) {
  const data = await request(`/Attendance/offered-course/${offeredCourseId}`, {
    method: "PUT",
    body: JSON.stringify({ teacherUserId, updates }),
  });
  return normalizeSheet(data);
}
