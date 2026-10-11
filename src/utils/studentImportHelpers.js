import { createStudent } from "../api/studentsApi";
import { parseExcelRows } from "./graderHelpers";

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

const ARID_COLUMN_KEYS = [
  "arid",
  "aridno",
  "arid no",
  "arid number",
  "ardi",
  "ardi no",
  "ardi number",
  "roll",
  "roll no",
  "rollno",
];

const NAME_COLUMN_KEYS = ["full name", "fullname", "name", "student name", "student"];
const EMAIL_COLUMN_KEYS = ["email", "mail", "e-mail"];

/** Example rows shown in the student upload modal. */
export const STUDENT_IMPORT_SAMPLE_ROWS = [
  {
    Section: "BSCS-3A",
    StuName: "Ammar Abu Hurraira",
    "Reg_no": "2023-Arid-0184",
    Email: "ammar@gmail.com",
  },
  {
    Section: "BSCS-3A",
    StuName: "Abubakar Siddiq",
    "Reg_no": "2023-Arid-0168",
    Email: "abubakar@gmail.com",
  },
];

export function parseStudentImportRow(row) {
  const fullName = pickRowValue(row, NAME_COLUMN_KEYS);
  const aridNo = pickRowValue(row, ARID_COLUMN_KEYS);
  const email = pickRowValue(row, EMAIL_COLUMN_KEYS);

  return {
    fullName: fullName.trim(),
    aridNo: aridNo.trim(),
    email: email.trim() || null,
  };
}

export async function importStudentsFromExcelFile(sectionId, file) {
  const rows = await parseExcelRows(file);
  let insertedCount = 0;
  let skippedCount = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const hasValues = Object.values(row).some((value) => String(value ?? "").trim());
    if (!hasValues) continue;

    const { fullName, aridNo, email } = parseStudentImportRow(row);

    if (!fullName && !aridNo) continue;

    if (!fullName) {
      errors.push(`Row ${i + 2}: Full Name is required.`);
      continue;
    }
    if (!aridNo) {
      errors.push(`Row ${i + 2}: ARID / Ardi Number is required.`);
      continue;
    }

    try {
      await createStudent({
        sectionId,
        fullName,
        aridNo,
        email,
      });
      insertedCount += 1;
    } catch (error) {
      const message = String(error?.message || "Failed to add student.");
      if (/duplicate|already|exists|skipped/i.test(message)) {
        skippedCount += 1;
      } else {
        errors.push(`Row ${i + 2} (${aridNo}): ${message}`);
      }
    }
  }

  return {
    insertedCount,
    skippedCount,
    errorCount: errors.length,
    errors,
  };
}
