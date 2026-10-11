import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { getAttendanceSheet, importAttendanceSheet, updateAttendanceSheet } from "../../api/attendanceApi";
import { getTeacherCoursesPage } from "../../api/teacherApi";
import { getGraderTasksMine } from "../../api/graderTasksApi";
import AppSelect from "../../components/AppSelect.jsx";
import { showAlert } from "../../utils/dialogs";
import { getAuthUserId } from "../../utils/helpers";
import theme from "../../styles/theme";

const STATUS_OPTIONS = [
  { value: "", label: "—" },
  { value: "Present", label: "P" },
  { value: "Absent", label: "A" },
  { value: "Leave", label: "L" },
];

const ARID_COL = "10.5rem";
const NAME_COL = "13rem";
const DATE_COL = "4.75rem";

function statusClass(status) {
  if (status === "Present") return "bg-emerald-50 text-emerald-800";
  if (status === "Absent") return "bg-red-50 text-red-800";
  if (status === "Leave") return "bg-amber-50 text-amber-900";
  return "bg-white text-gray-600";
}

function dateKey(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.slice(0, 10);
}

function formatDateLabel(value) {
  const key = dateKey(value);
  if (!key) return "";
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

export default function TeacherAttendanceScreen() {
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isGraderWorkspace = location.pathname.startsWith("/grader");
  const routeTeacher = searchParams.get("teacherUserId");
  const teacherUserId =
    routeTeacher != null && routeTeacher !== ""
      ? Number(routeTeacher) || getAuthUserId(user)
      : getAuthUserId(user);
  const routeCourse = searchParams.get("offeredCourseId");

  const [courses, setCourses] = useState([]);
  const [offeredCourseId, setOfferedCourseId] = useState(routeCourse || "");
  const [sheet, setSheet] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [newDate, setNewDate] = useState("");

  const loadCourses = useCallback(async () => {
    if (!teacherUserId && !isGraderWorkspace) {
      setLoading(false);
      return;
    }
    try {
      if (isGraderWorkspace) {
        const mine = await getGraderTasksMine();
        setCourses(
          mine
            .filter((row) => (row.tasks || []).some((t) => t.assigned && t.taskCode === "Attendance"))
            .map((row) => ({
              offeredCourseId: row.offeredCourseId,
              courseTitle: row.courseTitle,
              sectionName: row.sectionName,
            }))
        );
      } else {
        const data = await getTeacherCoursesPage({ teacherUserId, page: 1, pageSize: 48 });
        setCourses(data?.items || []);
      }
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [teacherUserId, isGraderWorkspace]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (offeredCourseId || !courses.length) return;
    setOfferedCourseId(String(courses[0].offeredCourseId ?? courses[0].OfferedCourseId));
  }, [courses, offeredCourseId]);

  const loadSheet = useCallback(async () => {
    if (!offeredCourseId || !teacherUserId) {
      setSheet(null);
      setDraft({});
      return;
    }
    try {
      setLoading(true);
      const data = await getAttendanceSheet(offeredCourseId, teacherUserId);
      setSheet(data);
      setDraft({});
    } catch (error) {
      showAlert("Error", error.message);
      setSheet(null);
    } finally {
      setLoading(false);
    }
  }, [offeredCourseId, teacherUserId]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  const dates = useMemo(() => {
    const fromSheet = (sheet?.dates || []).map(dateKey).filter(Boolean);
    const extra = Object.keys(draft)
      .map((key) => dateKey(key.split("|")[1]))
      .filter(Boolean);
    return Array.from(new Set([...fromSheet, ...extra])).sort();
  }, [sheet, draft]);

  const gridTemplate = useMemo(() => {
    const dateCols = dates.length > 0 ? `repeat(${dates.length}, ${DATE_COL})` : DATE_COL;
    return `${ARID_COL} ${NAME_COL} ${dateCols}`;
  }, [dates.length]);

  const cellValue = (studentId, date) => {
    const key = `${studentId}|${date}`;
    if (Object.prototype.hasOwnProperty.call(draft, key)) return draft[key];
    const student = (sheet?.students || []).find((s) => Number(s.studentId) === Number(studentId));
    const cell = student?.cells?.find((c) => dateKey(c.date) === date);
    return cell?.status || "";
  };

  const setCell = (studentId, date, status) => {
    setDraft((prev) => ({ ...prev, [`${studentId}|${date}`]: status }));
  };

  const dirtyCount = Object.keys(draft).length;

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name?.toLowerCase().endsWith(".xlsx")) {
      showAlert("Invalid File", "Please select a .xlsx attendance sheet.");
      e.target.value = "";
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!offeredCourseId) {
      showAlert("Select course", "Please select a course first.");
      return;
    }
    if (!selectedFile) {
      showAlert("No File", "Please select a .xlsx file.");
      return;
    }
    try {
      setUploading(true);
      const result = await importAttendanceSheet(offeredCourseId, teacherUserId, selectedFile);
      const extra =
        result.errors?.length > 0
          ? `\n\n${result.errors.slice(0, 6).join("\n")}${result.errors.length > 6 ? "\n..." : ""}`
          : "";
      showAlert(
        "Attendance uploaded",
        `Saved: ${result.upsertedCount}\nSkipped: ${result.skippedCount}${extra}`
      );
      if (result.sheet) {
        setSheet(result.sheet);
        setDraft({});
      } else {
        await loadSheet();
      }
      setSelectedFile(null);
    } catch (error) {
      showAlert("Upload Error", error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAddDate = () => {
    if (!newDate) {
      showAlert("Date required", "Choose a date to add.");
      return;
    }
    if (dates.includes(newDate)) {
      showAlert("Already added", "That date is already in the sheet.");
      return;
    }
    const next = { ...draft };
    for (const student of sheet?.students || []) {
      next[`${student.studentId}|${newDate}`] = "";
    }
    setDraft(next);
    setNewDate("");
  };

  const handleSave = async () => {
    if (!offeredCourseId || dirtyCount === 0) return;
    const updates = Object.entries(draft).map(([key, status]) => {
      const [studentId, date] = key.split("|");
      return { studentId: Number(studentId), date, status };
    });
    try {
      setSaving(true);
      const updated = await updateAttendanceSheet(offeredCourseId, teacherUserId, updates);
      setSheet(updated);
      setDraft({});
      showAlert("Saved", "Attendance updated.");
    } catch (error) {
      showAlert("Save Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedCourse = courses.find(
    (c) => String(c.offeredCourseId ?? c.OfferedCourseId) === String(offeredCourseId)
  );

  return (
    <div className="min-h-full bg-page">
      <div className="border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8 dark:border-[#1b2c2e] dark:bg-[#071113]">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Attendance</h1>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Upload a sheet, then edit Present / Absent on this page.
        </p>
      </div>

      <div className="px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card dark:border-[#1b2c2e] dark:bg-[#0c181a]">
          <label className="mb-1.5 block text-sm font-extrabold text-gray-700 dark:text-gray-300">
            Course
          </label>
          <AppSelect
            value={offeredCourseId}
            onChange={(e) => setOfferedCourseId(e.target.value)}
            className="w-full"
            disabled={courses.length === 0}
          >
            {courses.length === 0 ? (
              <option value="">No courses assigned</option>
            ) : (
              courses.map((course) => {
                const id = course.offeredCourseId ?? course.OfferedCourseId;
                return (
                  <option key={id} value={id}>
                    {course.courseTitle || course.CourseTitle} — {course.sectionName || course.SectionName}
                  </option>
                );
              })
            )}
          </AppSelect>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1 cursor-pointer rounded-lg bg-gray-100 px-3 py-3 text-sm font-semibold text-gray-600 dark:bg-[#122427] dark:text-gray-300">
              <input type="file" accept=".xlsx" className="hidden" onChange={pickFile} />
              {selectedFile?.name || "Choose .xlsx attendance sheet"}
            </label>
            <button
              type="button"
              disabled={uploading || !selectedFile}
              onClick={handleUpload}
              className="app-btn-primary shrink-0 rounded-xl px-5 py-3 font-extrabold disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload sheet"}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Excel columns: ARID (or Name), then one column per date (P / A / L).
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : !sheet ? (
          <p className="py-12 text-center text-sm text-gray-500">Select a course to view attendance.</p>
        ) : (sheet.students || []).length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">
            No students in {selectedCourse?.courseTitle || "this course"} yet. Add students to the section first.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {sheet.courseTitle} · {sheet.sectionName}
                </p>
                <p className="text-xs text-gray-500">
                  {sheet.students.length} student(s)
                  {dates.length ? ` · ${dates.length} date(s)` : " · no dates yet"}
                  {dirtyCount ? ` · ${dirtyCount} unsaved change(s)` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddDate}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-brand-muted/40 dark:border-[#1b2c2e] dark:text-gray-200"
                >
                  Add date
                </button>
                <button
                  type="button"
                  disabled={saving || dirtyCount === 0}
                  onClick={handleSave}
                  className="app-btn-primary rounded-lg px-4 py-2 text-sm font-extrabold disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>

            <div className="mt-3 overflow-auto rounded-2xl border border-gray-100 bg-white shadow-card dark:border-[#1b2c2e] dark:bg-[#0c181a]">
              <div className="min-w-max">
                <div
                  className="sticky top-0 z-20 grid border-b border-gray-200 bg-gray-50 dark:border-[#1b2c2e] dark:bg-[#122427]"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  <div className="sticky left-0 z-30 border-r border-gray-200 bg-gray-50 px-3 py-2 text-xs font-extrabold text-gray-700 dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-gray-200">
                    ARID
                  </div>
                  <div
                    className="sticky z-30 border-r border-gray-200 bg-gray-50 px-3 py-2 text-xs font-extrabold text-gray-700 shadow-[4px_0_8px_-6px_rgba(0,0,0,0.25)] dark:border-[#1b2c2e] dark:bg-[#122427] dark:text-gray-200"
                    style={{ left: ARID_COL }}
                  >
                    Student
                  </div>
                  {dates.length === 0 ? (
                    <div className="px-3 py-2 text-xs font-semibold text-gray-400">No dates yet</div>
                  ) : (
                    dates.map((date) => (
                      <div
                        key={date}
                        title={date}
                        className="px-1 py-2 text-center text-[11px] font-extrabold text-gray-700 dark:text-gray-200"
                      >
                        {formatDateLabel(date)}
                      </div>
                    ))
                  )}
                </div>

                {(sheet.students || []).map((student) => (
                  <div
                    key={student.studentId}
                    className="grid border-b border-gray-100 dark:border-[#1b2c2e]"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    <div className="sticky left-0 z-10 truncate border-r border-gray-100 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 dark:border-[#1b2c2e] dark:bg-[#0c181a] dark:text-gray-300">
                      {student.aridNo}
                    </div>
                    <div
                      className="sticky z-10 truncate border-r border-gray-100 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-[4px_0_8px_-6px_rgba(0,0,0,0.25)] dark:border-[#1b2c2e] dark:bg-[#0c181a] dark:text-white"
                      style={{ left: ARID_COL }}
                    >
                      {student.fullName}
                    </div>
                    {dates.length === 0 ? (
                      <div className="px-3 py-1.5 text-xs text-gray-400">—</div>
                    ) : (
                      dates.map((date) => {
                        const value = cellValue(student.studentId, date);
                        return (
                          <div key={`${student.studentId}-${date}`} className="px-1 py-1">
                            <select
                              value={value}
                              aria-label={`${student.fullName} ${formatDateLabel(date)}`}
                              title={value || "Not marked"}
                              onChange={(e) => setCell(student.studentId, date, e.target.value)}
                              className={`h-8 w-full rounded-md border border-gray-200 px-0.5 text-center text-xs font-bold ${statusClass(value)} dark:border-[#1b2c2e]`}
                            >
                              {STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value || "blank"} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })
                    )}
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">P = Present · A = Absent · L = Leave</p>
          </>
        )}
      </div>
    </div>
  );
}
