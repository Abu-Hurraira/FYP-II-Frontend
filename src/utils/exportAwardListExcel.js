import * as XLSX from "xlsx";
import { calculateGradeAndQPoint, numberToWords } from "./gradeHelpers";

export function exportAwardListExcel({ metadata, students = [], scheme }) {
  const {
    courseCode = "",
    courseTitle = "",
    creditHoursDisplay = "",
    teacherName = "",
    sessionTitle = "",
    programCode = "",
    sectionName = "",
    totalCreditHours = 3,
  } = metadata || {};

  const hasLab = Boolean(scheme?.hasLab ?? scheme?.HasLab ?? false);
  const hwMax = Number(scheme?.homeworkMarks ?? scheme?.HomeworkMarks ?? 0);
  const midMax = Number(scheme?.midMarks ?? scheme?.MidMarks ?? 0);
  const finalMax = Number(scheme?.finalMarks ?? scheme?.FinalMarks ?? 0);
  const labMax = Number(scheme?.labMarks ?? scheme?.LabMarks ?? 0);
  const theoryMax = midMax + hwMax + finalMax;
  const totalMax = Number(scheme?.totalMarks ?? scheme?.TotalMarks ?? (theoryMax + (hasLab ? labMax : 0)));

  const rows = [];

  // Title block
  rows.push(["PMAS Arid Agriculture University Rawalpindi", "", "", "", "", "", "", "", "", "", "", ""]);
  rows.push(["AWARD LIST", "", "", "", "", "", "", "", "", "", "", ""]);
  rows.push([]);

  // Subheader Metadata Block
  rows.push([
    "Course No :", courseCode || "N/A", "",
    "", "",
    "Instructor :", teacherName || "N/A", "",
    "", "", "", ""
  ]);
  rows.push([
    "Course    :", courseTitle || "N/A", "",
    "", "",
    "Semester   :", sessionTitle || "N/A", "",
    "", "", "", ""
  ]);
  rows.push([
    "Credit Hrs :", creditHoursDisplay || `${totalCreditHours}`, "",
    "", "",
    "Discipline :", programCode || "N/A", "",
    "", "", "", ""
  ]);
  rows.push([
    "", "", "",
    "", "",
    "Section    :", sectionName || "N/A", "",
    "", "", "", ""
  ]);
  rows.push([]);

  // Table Headers
  rows.push([
    "Sr No.",
    "Reg No.",
    "Name of Student",
    "THEORY", "", "", "",
    "Prac Score",
    "Grand Total",
    "In Words",
    "Grade",
    "Q Point"
  ]);

  rows.push([
    "", "", "",
    "Mid", "HW", "Final", "Total",
    "out of",
    "out of",
    "", "", ""
  ]);

  rows.push([
    "", "", "",
    `out of ${midMax}`,
    `out of ${hwMax}`,
    `out of ${finalMax}`,
    `out of ${theoryMax}`,
    `${hasLab ? labMax : 0}`,
    `${totalMax}`,
    "", "", ""
  ]);

  // Data Rows
  students.forEach((s, index) => {
    const hw = Number(s.homeworkMarks ?? s.HomeworkMarks ?? 0);
    const mid = Number(s.midMarks ?? s.MidMarks ?? 0);
    const final = Number(s.finalMarks ?? s.FinalMarks ?? 0);
    const theoryTotal = s.theoryTotal ?? s.TheoryTotal ?? (mid + hw + final);
    const prac = Number(s.labMarks ?? s.LabMarks ?? s.pracScore ?? s.PracScore ?? 0);
    const grandTotal = Number(s.totalObtained ?? s.TotalObtained ?? s.grandTotal ?? s.GrandTotal ?? (theoryTotal + (hasLab ? prac : 0)));
    const percentage = Number(s.percentage ?? s.Percentage ?? (totalMax > 0 ? (grandTotal / totalMax) * 100 : 0));

    const calculated = calculateGradeAndQPoint(percentage, totalCreditHours);
    const grade = s.grade || s.Grade || calculated.grade;
    const qPoint = s.qPoint ?? s.QPoint ?? calculated.qPoint;
    const inWords = s.inWords || s.InWords || numberToWords(grandTotal);

    rows.push([
      index + 1,
      s.aridNo ?? s.AridNo ?? "",
      (s.fullName ?? s.FullName ?? "").toUpperCase(),
      mid.toFixed(2),
      hw.toFixed(2),
      final.toFixed(2),
      theoryTotal % 1 === 0 ? theoryTotal.toFixed(0) : theoryTotal.toFixed(2),
      hasLab ? prac.toFixed(2) : "0.00",
      grandTotal % 1 === 0 ? grandTotal.toFixed(0) : grandTotal.toFixed(2),
      inWords,
      grade,
      Number(qPoint).toFixed(2)
    ]);
  });

  // Footer spacing
  rows.push([]);
  rows.push([]);

  // Controller / Branch Footer
  rows.push(["FOR THE USE OF CONTROLLER'S AND EXAMINATION BRANCH", "", "", "", "", "", "", "", "", "", "", ""]);
  rows.push([
    "Checked By", "_______________",
    "Received By", "_______________",
    "Teacher's Signature", "_______________",
    "Date", "_______________"
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  worksheet["!cols"] = [
    { wch: 8 },  // Sr No.
    { wch: 18 }, // Reg No.
    { wch: 30 }, // Name of Student
    { wch: 10 }, // Mid
    { wch: 10 }, // HW
    { wch: 10 }, // Final
    { wch: 10 }, // Total
    { wch: 12 }, // Prac Score
    { wch: 12 }, // Grand Total
    { wch: 18 }, // In Words
    { wch: 8 },  // Grade
    { wch: 10 }  // Q Point
  ];

  // Cell merges
  const headerRowIndex = 8;
  worksheet["!merges"] = [
    // Title row merges
    { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },

    // Metadata merges
    { s: { r: 3, c: 1 }, e: { r: 3, c: 4 } },
    { s: { r: 3, c: 6 }, e: { r: 3, c: 11 } },
    { s: { r: 4, c: 1 }, e: { r: 4, c: 4 } },
    { s: { r: 4, c: 6 }, e: { r: 4, c: 11 } },
    { s: { r: 5, c: 1 }, e: { r: 5, c: 4 } },
    { s: { r: 5, c: 6 }, e: { r: 5, c: 11 } },
    { s: { r: 6, c: 6 }, e: { r: 6, c: 11 } },

    // Table Header Merges
    { s: { r: headerRowIndex, c: 0 }, e: { r: headerRowIndex + 2, c: 0 } }, // Sr No.
    { s: { r: headerRowIndex, c: 1 }, e: { r: headerRowIndex + 2, c: 1 } }, // Reg No.
    { s: { r: headerRowIndex, c: 2 }, e: { r: headerRowIndex + 2, c: 2 } }, // Name
    { s: { r: headerRowIndex, c: 3 }, e: { r: headerRowIndex, c: 6 } },     // THEORY
    { s: { r: headerRowIndex, c: 9 }, e: { r: headerRowIndex + 2, c: 9 } }, // In Words
    { s: { r: headerRowIndex, c: 10 }, e: { r: headerRowIndex + 2, c: 10 } },// Grade
    { s: { r: headerRowIndex, c: 11 }, e: { r: headerRowIndex + 2, c: 11 } },// Q Point

    // Footer merge
    { s: { r: rows.length - 2, c: 0 }, e: { r: rows.length - 2, c: 11 } }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "AWARD LIST");

  const cleanCourse = (courseCode || "RESULT").replace(/[^a-zA-Z0-9_-]/g, "_");
  const cleanSection = (sectionName || "").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `AWARD_LIST_${cleanCourse}_${cleanSection}.xlsx`;

  XLSX.writeFile(workbook, fileName);
}
