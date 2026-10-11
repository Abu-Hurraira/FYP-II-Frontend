export function calculateGradeAndQPoint(percentage, creditHours = 3) {
  const pct = Number(percentage) || 0;
  let grade = "F";
  let gpa = 0.0;

  if (pct >= 80) {
    grade = "A";
    gpa = 4.0;
  } else if (pct >= 65) {
    grade = "B";
    gpa = Math.round((3.0 + (pct - 65) * 0.07) * 10) / 10;
  } else if (pct >= 50) {
    grade = "C";
    gpa = Math.round((2.0 + (pct - 50) * 0.06) * 10) / 10;
  } else if (pct >= 40) {
    grade = "D";
    gpa = Math.round((1.0 + (pct - 40) * 0.10) * 10) / 10;
  } else {
    grade = "F";
    gpa = 0.0;
  }

  const qPoint = Number((gpa * Math.max(creditHours, 1)).toFixed(2));
  return { grade, gpa, qPoint };
}

export function numberToWords(num) {
  const n = Math.round(Number(num) || 0);
  if (n <= 0) return "ZERO";
  if (n === 100) return "ONE HUNDRED";

  const ones = [
    "", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN",
    "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"
  ];
  const tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];

  if (n < 20) return ones[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const r = n % 10;
    return r === 0 ? tens[t] : `${tens[t]}-${ones[r]}`;
  }

  return String(n);
}
