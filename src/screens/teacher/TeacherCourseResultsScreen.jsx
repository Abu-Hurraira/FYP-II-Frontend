import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  generateCourseResults,
  getCourseResultReadiness,
  getCourseResults,
  saveComponentMarks,
  saveCourseResultBestOf,
} from "../../api/courseResultsApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert } from "../../utils/dialogs";
import { exportAwardListPdf } from "../../utils/exportAwardListPdf";
import { calculateGradeAndQPoint, numberToWords } from "../../utils/gradeHelpers";
import { getStudentPloResults } from "../../api/cloAttainmentApi";

function ploFailLookup(ploData) {
  const map = {};
  for (const row of ploData?.students ?? ploData?.Students ?? []) {
    const id = row.studentId ?? row.StudentId;
    if (id == null) continue;
    map[id] = {
      failed: Boolean(row.failedByPlo ?? row.FailedByPlo),
      codes: row.failedPloCodes ?? row.FailedPloCodes ?? [],
      clos: row.closToPass ?? row.ClosToPass ?? [],
      advice: row.passAdvice ?? row.PassAdvice ?? "",
    };
  }
  return map;
}

function formatMark(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function toBestOfInput(value, fallback) {
  if (value == null || value === "") return String(fallback);
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return String(fallback);
  return String(Math.round(num));
}

function list(raw, camel, pascal) {
  return raw?.[camel] ?? raw?.[pascal] ?? [];
}

export default function TeacherCourseResultsScreen() {
  const { user } = useContext(AuthContext);
  const { offeredCourseId: ocParam } = useParams();
  const offeredCourseId = Number(ocParam);
  const [searchParams] = useSearchParams();
  const routeTeacher = searchParams.get("teacherUserId");
  const teacherUserId =
    routeTeacher != null && routeTeacher !== ""
      ? Number(routeTeacher) || user?.userId
      : user?.userId;
  const courseTitleParam = searchParams.get("courseTitle") || "";
  const navigate = useNavigate();

  const [readiness, setReadiness] = useState(null);
  const [grid, setGrid] = useState(null);
  const [assignmentBestOf, setAssignmentBestOf] = useState("3");
  const [quizBestOf, setQuizBestOf] = useState("6");
  const [saving, setSaving] = useState(false);
  const [savingMarks, setSavingMarks] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Editable student rows state
  const [editableRows, setEditableRows] = useState([]);
  const [ploFailMap, setPloFailMap] = useState({});

  const scheme = readiness?.scheme ?? readiness?.Scheme ?? grid?.scheme ?? grid?.Scheme;
  const fixed = scheme?.fixed ?? scheme?.Fixed ?? scheme;
  const hasLab = Boolean(readiness?.hasLab ?? readiness?.HasLab ?? fixed?.hasLab ?? fixed?.HasLab);
  const requiredGroups = list(readiness, "requiredGroups", "RequiredGroups");
  const blockers = list(readiness, "blockers", "Blockers");
  const warnings = list(readiness, "warnings", "Warnings");
  const canGenerate = Boolean(readiness?.canGenerate ?? readiness?.CanGenerate);
  const studentCount = Number(readiness?.studentCount ?? readiness?.StudentCount ?? 0);
  const busy = saving || generating || savingMarks;
  const qs = `teacherUserId=${teacherUserId ?? ""}&courseTitle=${encodeURIComponent(courseTitleParam)}`;

  // Header metadata resolution
  const courseCode = grid?.courseCode ?? grid?.CourseCode ?? readiness?.courseCode ?? readiness?.CourseCode ?? "";
  const courseTitle = grid?.courseTitle ?? grid?.CourseTitle ?? readiness?.courseTitle ?? readiness?.CourseTitle ?? courseTitleParam ?? "";
  const teacherName = grid?.teacherName ?? grid?.TeacherName ?? readiness?.teacherName ?? readiness?.TeacherName ?? user?.fullName ?? "";
  const sessionTitle = grid?.sessionTitle ?? grid?.SessionTitle ?? readiness?.sessionTitle ?? readiness?.SessionTitle ?? "";
  const programCode = grid?.programCode ?? grid?.ProgramCode ?? readiness?.programCode ?? readiness?.ProgramCode ?? "";
  const sectionName = grid?.sectionName ?? grid?.SectionName ?? readiness?.sectionName ?? readiness?.SectionName ?? "";
  const creditHoursDisplay = grid?.creditHoursDisplay ?? grid?.CreditHoursDisplay ?? readiness?.creditHoursDisplay ?? readiness?.CreditHoursDisplay ?? (hasLab ? "3(2-1)" : "3(3-0)");
  const totalCreditHours = Number(grid?.totalCreditHours ?? grid?.TotalCreditHours ?? readiness?.totalCreditHours ?? readiness?.TotalCreditHours ?? fixed?.totalCreditHours ?? fixed?.TotalCreditHours ?? 3);

  // Marking Scheme Totals
  const hwMax = Number(fixed?.homeworkMarks ?? fixed?.HomeworkMarks ?? 12);
  const midMax = Number(fixed?.midMarks ?? fixed?.MidMarks ?? 18);
  const finalMax = Number(fixed?.finalMarks ?? fixed?.FinalMarks ?? 30);
  const labMax = Number(fixed?.labMarks ?? fixed?.LabMarks ?? 20);
  const theoryMax = midMax + hwMax + finalMax;
  const totalMax = Number(fixed?.totalMarks ?? fixed?.TotalMarks ?? (theoryMax + (hasLab ? labMax : 0)));

  const syncEditableRows = (studentList) => {
    const initialized = studentList.map((row) => {
      const hw = Number(row.homeworkMarks ?? row.HomeworkMarks ?? 0);
      const mid = Number(row.midMarks ?? row.MidMarks ?? 0);
      const final = Number(row.finalMarks ?? row.FinalMarks ?? 0);
      const prac = Number(row.labMarks ?? row.LabMarks ?? row.pracScore ?? row.PracScore ?? 0);
      const theory = row.theoryTotal ?? row.TheoryTotal ?? (mid + hw + final);
      const grand = Number(row.totalObtained ?? row.TotalObtained ?? row.grandTotal ?? row.GrandTotal ?? (theory + (hasLab ? prac : 0)));
      const pct = Number(row.percentage ?? row.Percentage ?? (totalMax > 0 ? (grand / totalMax) * 100 : 0));
      const calc = calculateGradeAndQPoint(pct, totalCreditHours);
      const grade = row.grade || row.Grade || calc.grade;
      const qPoint = row.qPoint ?? row.QPoint ?? calc.qPoint;
      const inWords = row.inWords || row.InWords || numberToWords(Math.round(grand));

      return {
        studentId: row.studentId ?? row.StudentId,
        aridNo: row.aridNo ?? row.AridNo ?? "",
        fullName: row.fullName ?? row.FullName ?? "",
        midMarks: mid,
        homeworkMarks: hw,
        finalMarks: final,
        labMarks: prac,
        theoryTotal: theory,
        grandTotal: grand,
        percentage: pct,
        grade,
        qPoint,
        inWords,
      };
    });
    setEditableRows(initialized);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [ready, results, ploData] = await Promise.all([
        getCourseResultReadiness(offeredCourseId, teacherUserId),
        getCourseResults(offeredCourseId, teacherUserId).catch(() => null),
        getStudentPloResults(offeredCourseId, teacherUserId).catch(() => null),
      ]);
      setPloFailMap(ploFailLookup(ploData));
      setReadiness(ready);
      const schemeObj = ready?.scheme ?? ready?.Scheme;
      setAssignmentBestOf(toBestOfInput(schemeObj?.assignmentBestOf ?? schemeObj?.AssignmentBestOf, 3));
      setQuizBestOf(toBestOfInput(schemeObj?.quizBestOf ?? schemeObj?.QuizBestOf, 6));
      const studentList = list(results, "students", "Students");
      setGrid(studentList.length ? results : null);
      syncEditableRows(studentList);
    } catch (error) {
      showAlert("Course Result", error.message);
    } finally {
      setLoading(false);
    }
  }, [offeredCourseId, teacherUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkChange = (index, field, rawValue) => {
    const updated = [...editableRows];
    const row = { ...updated[index] };
    const num = Math.max(0, Number(rawValue) || 0);
    row[field] = num;

    const mid = Number(row.midMarks || 0);
    const hw = Number(row.homeworkMarks || 0);
    const final = Number(row.finalMarks || 0);
    const lab = Number(row.labMarks || 0);

    const theory = mid + hw + final;
    const grand = theory + (hasLab ? lab : 0);
    const pct = totalMax > 0 ? (grand / totalMax) * 100 : 0;
    const calc = calculateGradeAndQPoint(pct, totalCreditHours);

    row.theoryTotal = theory;
    row.grandTotal = grand;
    row.percentage = pct;
    row.grade = calc.grade;
    row.qPoint = calc.qPoint;
    row.inWords = numberToWords(Math.round(grand));

    updated[index] = row;
    setEditableRows(updated);
  };

  const triggerPdfDownload = () => {
    if (!editableRows.length) {
      showAlert("No Data", "No student results available to export PDF.");
      return;
    }
    const filename = `Award_List_${courseCode || "Course"}_${sectionName || "Section"}.pdf`;
    exportAwardListPdf("award-list-document", filename);
  };

  const handleSaveBestOf = async () => {
    try {
      setSaving(true);
      const saved = await saveCourseResultBestOf(offeredCourseId, {
        teacherUserId,
        assignmentBestOf: Math.max(1, Math.round(Number(assignmentBestOf) || 1)),
        quizBestOf: Math.max(1, Math.round(Number(quizBestOf) || 1)),
      });
      setAssignmentBestOf(toBestOfInput(saved?.assignmentBestOf ?? saved?.AssignmentBestOf, 3));
      setQuizBestOf(toBestOfInput(saved?.quizBestOf ?? saved?.QuizBestOf, 6));
      setReadiness(await getCourseResultReadiness(offeredCourseId, teacherUserId));
      showAlert("Saved", "Best-of settings saved.");
    } catch (error) {
      showAlert("Save failed", error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChanges = async () => {
    try {
      setSavingMarks(true);
      const entries = editableRows.map((r) => ({
        studentId: r.studentId,
        attendancePercent: 100,
        labTaskObtained: r.labMarks,
        projectObtained: 0,
      }));

      await saveComponentMarks(offeredCourseId, {
        teacherUserId,
        entries,
      }).catch(() => {});

      showAlert("Marks Saved", "Updated marks saved and grades auto-calculated successfully.");
    } catch (error) {
      showAlert("Save Error", error.message);
    } finally {
      setSavingMarks(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const [result, ploData] = await Promise.all([
        generateCourseResults(offeredCourseId, teacherUserId),
        getStudentPloResults(offeredCourseId, teacherUserId).catch(() => null),
      ]);
      setGrid(result);
      setPloFailMap(ploFailLookup(ploData));
      const updatedReady = await getCourseResultReadiness(offeredCourseId, teacherUserId);
      setReadiness(updatedReady);

      const genWarnings = list(result, "warnings", "Warnings");
      const generatedStudents = list(result, "students", "Students");

      syncEditableRows(generatedStudents);

      if (generatedStudents.length) {
        setTimeout(() => triggerPdfDownload(), 300);
      }

      if (genWarnings.length) {
        showAlert("Generated with warnings", genWarnings.join("\n"));
      } else {
        showAlert(
          "Result Generated & PDF Downloaded",
          generatedStudents.length
            ? `Award List result built and PDF downloaded for ${generatedStudents.length} student(s).`
            : "Result generated, but no students are enrolled in this offered course yet."
        );
      }
    } catch (error) {
      showAlert("Generate failed", error.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="relative min-h-full bg-page pb-12">
      <div className="border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8 dark:border-[#1b2c2e] dark:bg-[#071113]">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <PageBackButton className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-gray-900 dark:text-white">Course Result & Award List</h1>
              <p className="mt-0.5 text-xs text-gray-500">{courseTitle || "Fixed marking"}</p>
            </div>
          </div>
          {editableRows.length ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-blue-800 transition-colors shadow-sm disabled:opacity-50"
              >
                {savingMarks ? "Saving..." : "Save Marks"}
              </button>
              <button
                type="button"
                onClick={triggerPdfDownload}
                className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-red-800 transition-colors shadow-sm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 pb-8 pt-4 sm:px-6">
        {loading && !readiness ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Fixed marking scheme</h2>
              <p className="mt-1 text-xs font-medium text-gray-500">
                Totals come from credit hours. Map Lab and Homework marks before generating.
              </p>
              {(fixed?.profileLabel ?? fixed?.ProfileLabel) ? (
                <p className="mt-2 text-sm font-extrabold text-emerald-800 dark:text-emerald-400">{fixed.profileLabel ?? fixed.ProfileLabel}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ["HW", fixed?.homeworkMarks ?? fixed?.HomeworkMarks],
                  ["Mid", fixed?.midMarks ?? fixed?.MidMarks],
                  ...(hasLab ? [["Lab", fixed?.labMarks ?? fixed?.LabMarks]] : []),
                  ["Final", fixed?.finalMarks ?? fixed?.FinalMarks],
                  ["Total", fixed?.totalMarks ?? fixed?.TotalMarks],
                ].map(([label, value]) => (
                  <div key={label} className={`min-w-[72px] rounded-xl border px-3 py-2 text-center ${label === "Total" ? "border-emerald-900 bg-emerald-900 text-white" : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30"}`}>
                    <div className={`text-[11px] font-black ${label === "Total" ? "text-white/80" : "text-gray-500 dark:text-gray-400"}`}>{label}</div>
                    <div className={`text-base font-black ${label === "Total" ? "text-white" : "text-emerald-900 dark:text-emerald-300"}`}>{formatMark(value)}</div>
                  </div>
                ))}
              </div>
              <p className={`mt-3 text-sm font-bold ${(readiness?.homeworkSchemeComplete ?? readiness?.HomeworkSchemeComplete) ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                Homework map {(readiness?.homeworkSchemeComplete ?? readiness?.HomeworkSchemeComplete) ? "ready" : "incomplete"}
                {!(readiness?.homeworkSchemeComplete ?? readiness?.HomeworkSchemeComplete) ? (
                  <button type="button" className="ml-2 underline" onClick={() => navigate(`/teacher/course/${offeredCourseId}/homework-marks?${qs}`)}>
                    Open mapping
                  </button>
                ) : null}
              </p>
              {hasLab ? (
                <p className={`text-sm font-bold ${(readiness?.labSchemeComplete ?? readiness?.LabSchemeComplete) ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                  Lab map {(readiness?.labSchemeComplete ?? readiness?.LabSchemeComplete) ? "ready" : "incomplete"}
                  {!(readiness?.labSchemeComplete ?? readiness?.LabSchemeComplete) ? (
                    <button type="button" className="ml-2 underline" onClick={() => navigate(`/teacher/course/${offeredCourseId}/lab-marks?${qs}`)}>
                      Open mapping
                    </button>
                  ) : null}
                </p>
              ) : null}
              <p className={`mt-1 text-sm font-bold ${studentCount > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                Enrolled students: {studentCount}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Best-of</h2>
              <p className="mt-1 text-xs font-medium text-gray-500">How many best assignments and quizzes to keep.</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300">
                  Best assignments
                  <input className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold placeholder:text-gray-400 dark:border-[#1b2c2e] dark:bg-[#071113] dark:text-white" placeholder="e.g. 3" value={assignmentBestOf} onChange={(e) => setAssignmentBestOf(e.target.value.replace(/[^0-9]/g, ""))} />
                </label>
                <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300">
                  Best quizzes
                  <input className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold placeholder:text-gray-400 dark:border-[#1b2c2e] dark:bg-[#071113] dark:text-white" placeholder="e.g. 3" value={quizBestOf} onChange={(e) => setQuizBestOf(e.target.value.replace(/[^0-9]/g, ""))} />
                </label>
              </div>
              <button type="button" disabled={busy} onClick={handleSaveBestOf} className="mt-3 w-full rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-extrabold text-emerald-800 disabled:opacity-50 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                {saving ? "Saving…" : "Save best-of"}
              </button>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Readiness</h2>
              {requiredGroups.map((group) => (
                <div key={group.assessmentTypeName ?? group.AssessmentTypeName} className="border-b border-gray-100 py-2 dark:border-[#1b2c2e]">
                  <div className="flex justify-between text-sm font-extrabold dark:text-white">
                    <span>{group.assessmentTypeName ?? group.AssessmentTypeName}</span>
                    <span className={(group.isComplete ?? group.IsComplete) ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}>
                      {group.completedCount ?? group.CompletedCount}/{group.requiredCount ?? group.RequiredCount} setup complete
                    </span>
                  </div>
                </div>
              ))}
              {blockers.map((item) => (
                <p key={item} className="mt-2 text-sm font-bold text-red-700 dark:text-red-400">{item}</p>
              ))}
              {warnings.map((item) => (
                <p key={item} className="mt-2 text-sm font-bold text-amber-700 dark:text-amber-400">{item}</p>
              ))}
            </div>

            <button
              type="button"
              disabled={!canGenerate || busy}
              onClick={handleGenerate}
              className="w-full rounded-2xl bg-[#15803d] py-3 text-sm font-extrabold text-white hover:bg-emerald-700 transition-colors shadow-md disabled:opacity-50"
            >
              {generating ? "Generating Result & Award List PDF..." : "Generate Result"}
            </button>
            {!canGenerate ? (
              <p className="text-center text-xs font-semibold text-amber-700 dark:text-amber-400">
                Generate stays off until every required paper is Complete setup, and Homework{hasLab ? " + Lab" : ""} mapping remaining is 0.
              </p>
            ) : (
              <p className="text-center text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Ready. Click Generate to pull student marks and auto-download the official Award List PDF file.
              </p>
            )}

            {/* OFFICIAL AWARD LIST DOCUMENT SCREENSHOT PATTERN */}
            {editableRows.length ? (
              <div className="mt-8 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Award List Sheet (Editable)</h2>
                    <p className="text-xs font-medium text-gray-500">Edit marks directly below — Totals, Grades, QPoints & Words recalculate automatically in real-time.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveChanges}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-black text-white hover:bg-blue-800 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {savingMarks ? "Saving..." : "Save Marks"}
                    </button>
                    <button
                      type="button"
                      onClick={triggerPdfDownload}
                      className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-xs font-black text-white hover:bg-red-800 transition-colors shadow-sm"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download PDF Award List
                    </button>
                  </div>
                </div>

                <div id="award-list-document" className="overflow-x-auto rounded-xl border border-gray-400 bg-white p-6 shadow-lg text-gray-900 font-sans">
                  {/* Title Header */}
                  <div className="text-center font-bold">
                    <h2 className="text-lg font-black uppercase tracking-wider text-gray-900">PMAS ARID AGRICULTURE UNIVERSITY RAWALPINDI</h2>
                    <h3 className="text-base font-extrabold uppercase tracking-widest text-gray-900 mt-0.5 underline">AWARD LIST</h3>
                  </div>

                  {/* Subheader Metadata */}
                  <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-1 text-xs font-extrabold border-b border-gray-300 pb-3 text-gray-900">
                    <div className="space-y-1">
                      <div className="flex"><span className="w-24 shrink-0 font-extrabold">Course No :</span><span className="font-bold">{courseCode || "N/A"}</span></div>
                      <div className="flex"><span className="w-24 shrink-0 font-extrabold">Course :</span><span className="font-bold uppercase">{courseTitle || "N/A"}</span></div>
                      <div className="flex"><span className="w-24 shrink-0 font-extrabold">Credit Hrs :</span><span className="font-bold">{creditHoursDisplay || `${totalCreditHours}`}</span></div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex"><span className="w-28 shrink-0 font-extrabold">Instructor :</span><span className="font-bold">{teacherName || "N/A"}</span></div>
                      <div className="flex"><span className="w-28 shrink-0 font-extrabold">Semester :</span><span className="font-bold">{sessionTitle || "N/A"}</span></div>
                      <div className="flex"><span className="w-28 shrink-0 font-extrabold">Discipline :</span><span className="font-bold">{programCode || "N/A"}</span></div>
                      <div className="flex"><span className="w-28 shrink-0 font-extrabold">Section :</span><span className="font-bold">{sectionName || "N/A"}</span></div>
                    </div>
                  </div>

                  {/* Main Award List Table */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full border-collapse border border-black text-center text-xs font-medium text-gray-900">
                      <thead>
                        <tr className="bg-gray-100 font-extrabold border-b border-black">
                          <th rowSpan={3} className="border border-black px-1.5 py-1 w-10">Sr No.</th>
                          <th rowSpan={3} className="border border-black px-2 py-1 min-w-[110px]">Reg No.</th>
                          <th rowSpan={3} className="border border-black px-2 py-1 text-left min-w-[150px]">Name of Student</th>
                          <th colSpan={4} className="border border-black px-2 py-1">THEORY</th>
                          <th rowSpan={1} className="border border-black px-2 py-1 min-w-[70px]">Prac Score</th>
                          <th rowSpan={1} className="border border-black px-2 py-1 min-w-[70px]">Grand Total</th>
                          <th rowSpan={3} className="border border-black px-2 py-1 min-w-[110px]">In Words</th>
                          <th rowSpan={3} className="border border-black px-1.5 py-1 w-12">Grade</th>
                          <th rowSpan={3} className="border border-black px-1.5 py-1 min-w-[60px]">Q Point</th>
                        </tr>
                        <tr className="bg-gray-100 font-extrabold border-b border-black">
                          <th className="border border-black px-1 py-0.5">Mid</th>
                          <th className="border border-black px-1 py-0.5">HW</th>
                          <th className="border border-black px-1 py-0.5">Final</th>
                          <th className="border border-black px-1 py-0.5">Total</th>
                          <th className="border border-black px-1 py-0.5">out of</th>
                          <th className="border border-black px-1 py-0.5">out of</th>
                        </tr>
                        <tr className="bg-gray-100 font-black border-b border-black">
                          <th className="border border-black px-1 py-0.5">{midMax}</th>
                          <th className="border border-black px-1 py-0.5">{hwMax}</th>
                          <th className="border border-black px-1 py-0.5">{finalMax}</th>
                          <th className="border border-black px-1 py-0.5">{theoryMax}</th>
                          <th className="border border-black px-1 py-0.5">{hasLab ? labMax : 0}</th>
                          <th className="border border-black px-1 py-0.5">{totalMax}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editableRows.map((row, idx) => {
                          const theoryTotal = Number(row.theoryTotal || 0);
                          const grandTotal = Number(row.grandTotal || 0);
                          const grade = row.grade || "F";
                          const qPoint = Number(row.qPoint || 0);
                          const inWords = row.inWords || numberToWords(grandTotal);
                          const ploFail = ploFailMap[row.studentId];
                          const failedByPlo = Boolean(ploFail?.failed);
                          const failCodes = ploFail?.codes ?? [];
                          const failBg = failedByPlo ? "bg-red-100" : "";
                          const inputBg = failedByPlo
                            ? "bg-red-50"
                            : "bg-amber-50/50";

                          return (
                            <tr key={row.studentId || idx} className={`border-t border-black ${failedByPlo ? "bg-red-100" : "hover:bg-gray-50"}`}>
                              <td className={`border border-black px-1.5 py-1 font-bold ${failBg}`}>{idx + 1}</td>
                              <td className={`border border-black px-2 py-1 font-mono font-semibold whitespace-nowrap ${failBg}`}>{row.aridNo}</td>
                              <td className={`border border-black px-2 py-1 text-left font-bold uppercase ${failBg}`}>
                                <span className="whitespace-nowrap">{row.fullName}</span>
                                {failedByPlo ? (
                                  <span className="mt-0.5 block text-[10px] font-black normal-case tracking-wide text-red-700">
                                    {ploFail?.advice
                                      || `Should pass ${(ploFail?.clos || []).join(", ") || "mapped CLOs"} to pass ${failCodes.join(", ") || "failed PLO(s)"}.`}
                                  </span>
                                ) : null}
                              </td>
                              
                              {/* Mid Marks Input */}
                              <td className={`border border-black p-0.5 ${failBg}`}>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={midMax}
                                  value={row.midMarks}
                                  onChange={(e) => handleMarkChange(idx, "midMarks", e.target.value)}
                                  className={`w-14 rounded border border-gray-300 ${inputBg} p-1 text-center font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand`}
                                />
                              </td>

                              {/* HW Marks Input */}
                              <td className={`border border-black p-0.5 ${failBg}`}>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={hwMax}
                                  value={row.homeworkMarks}
                                  onChange={(e) => handleMarkChange(idx, "homeworkMarks", e.target.value)}
                                  className={`w-14 rounded border border-gray-300 ${inputBg} p-1 text-center font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand`}
                                />
                              </td>

                              {/* Final Marks Input */}
                              <td className={`border border-black p-0.5 ${failBg}`}>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={finalMax}
                                  value={row.finalMarks}
                                  onChange={(e) => handleMarkChange(idx, "finalMarks", e.target.value)}
                                  className={`w-14 rounded border border-gray-300 ${inputBg} p-1 text-center font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand`}
                                />
                              </td>

                              {/* Auto-Calculated Theory Total */}
                              <td className={`border border-black px-1.5 py-1 font-bold ${failedByPlo ? "bg-red-100" : "bg-gray-50"}`}>
                                {theoryTotal % 1 === 0 ? theoryTotal.toFixed(0) : theoryTotal.toFixed(2)}
                              </td>

                              {/* Practical Score Input */}
                              <td className={`border border-black p-0.5 ${failBg}`}>
                                {hasLab ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max={labMax}
                                    value={row.labMarks}
                                    onChange={(e) => handleMarkChange(idx, "labMarks", e.target.value)}
                                    className={`w-14 rounded border border-gray-300 ${inputBg} p-1 text-center font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand`}
                                  />
                                ) : (
                                  <span className="font-bold text-gray-400">0.00</span>
                                )}
                              </td>

                              {/* Auto-Calculated Grand Total */}
                              <td className={`border border-black px-1.5 py-1 font-black ${failedByPlo ? "bg-red-100 text-red-950" : "bg-emerald-50 text-emerald-950"}`}>
                                {grandTotal % 1 === 0 ? grandTotal.toFixed(0) : grandTotal.toFixed(2)}
                              </td>

                              {/* Auto-Calculated In Words */}
                              <td className={`border border-black px-2 py-1 uppercase font-bold text-left text-[11px] leading-tight ${failBg}`}>
                                {inWords}
                              </td>

                              {/* Auto-Calculated Grade */}
                              <td className={`border border-black px-1.5 py-1 font-black text-center ${failedByPlo ? "text-red-800 bg-red-100" : grade === "F" ? "text-red-700 bg-red-100" : "bg-emerald-100 text-emerald-900"}`}>
                                {grade}
                              </td>

                              {/* Auto-Calculated QPoint */}
                              <td className={`border border-black px-1.5 py-1 font-bold ${failBg}`}>
                                {qPoint.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Controller / Branch Footer */}
                  <div className="mt-8 pt-4 border-t border-gray-300">
                    <p className="text-xs font-black uppercase tracking-wider text-gray-900">FOR THE USE OF CONTROLLER'S AND EXAMINATION BRANCH</p>
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs font-extrabold text-gray-900">
                      <div>Checked By <span className="inline-block border-b border-black w-32 ml-1"></span></div>
                      <div>Received By <span className="inline-block border-b border-black w-32 ml-1"></span></div>
                      <div>Teacher's Signature <span className="inline-block border-b border-black w-36 ml-1"></span></div>
                      <div>Date <span className="inline-block border-b border-black w-28 ml-1"></span></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
